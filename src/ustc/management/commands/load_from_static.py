import json
import logging
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from django.core.management.base import BaseCommand
from django.db import transaction
from tqdm import tqdm

from ustc.models import *

logger = logging.getLogger(__name__)


def download_static_cache(target_dir: Path) -> Path:
    """Ensure Life-USTC/static@gh-pages is present and updated, sparse-checkout 'cache'.

    Idempotent: if the repo exists, it will fetch/reset to origin/gh-pages and update
    sparse-checkout to only include 'cache'. If not present, it will clone.

    Returns Path to target_dir/static/cache.
    """

    repo_dir = target_dir / "static"
    cache_dir = repo_dir / "cache"
    target_dir.mkdir(parents=True, exist_ok=True)

    def run(cmd: list[str], cwd: Path = repo_dir) -> None:
        subprocess.run(cmd, cwd=cwd, check=True)

    if repo_dir.exists() and (repo_dir / ".git").exists():
        run(
            [
                "git",
                "remote",
                "set-url",
                "origin",
                "https://github.com/Life-USTC/static.git",
            ]
        )
        run(["git", "fetch", "--depth", "1", "origin", "gh-pages"])
        run(["git", "checkout", "-B", "gh-pages"])
        run(["git", "reset", "--hard", "origin/gh-pages"])
        run(["git", "sparse-checkout", "init", "--cone"])
        run(["git", "sparse-checkout", "set", "cache"])
        run(["git", "checkout"])
    else:
        run(
            [
                "git",
                "clone",
                "--no-checkout",
                "--depth",
                "1",
                "--branch",
                "gh-pages",
                "https://github.com/Life-USTC/static.git",
                "static",
            ],
            cwd=target_dir,
        )
        run(["git", "sparse-checkout", "init", "--cone"])
        run(["git", "sparse-checkout", "set", "cache"])
        run(["git", "checkout"])

    return cache_dir


class Command(BaseCommand):
    help = "Load data from Life-USTC/static cache into DB (optionally download/refresh cache)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--cache-dir",
            default="./.cache/life-ustc/static",
            help="Directory holding static repo clone",
        )
        parser.add_argument(
            "--log-level",
            default="INFO",
            choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        )

    def setup_logger(self):
        handler = logging.StreamHandler(self.stdout)
        formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
        handler.setFormatter(formatter)
        handler.setLevel(logging.DEBUG)

        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

    def handle(self, *args, **options):
        self.setup_logger()
        logger.setLevel(getattr(logging, options["log_level"]))

        cache_dir = Path(options["cache_dir"])
        cache_root = download_static_cache(cache_dir)
        logger.info(f"Static cache updated at: {cache_root}")

        # 1) Load semesters from local cache
        semesters = load_semesters_from_cache(cache_root)
        if not semesters:
            logger.error("No semesters loaded from cache. Aborting.")
            return

        for semester in semesters:
            logger.info(f"Processing semester: {semester.name} ({semester.code})")

            # 2) Load sections for selected semesters
            load_sections(cache_root, semester)

            # 3) Load schedules for selected semesters
            load_schedules(cache_root, semester)


def load_semesters_from_cache(cache_root: Path) -> list[Semester]:
    """Read semesters list from cache and upsert into DB.

    Expected file: cache_root/catalog/api/teach/semester/list.json
    """

    data = json.loads(
        (cache_root / "catalog" / "api" / "teach" / "semester" / "list.json").read_text(
            encoding="utf-8"
        )
    )

    semesters = []
    for semester_json in data:
        semester, _ = Semester.objects.update_or_create(
            jw_id=semester_json["id"],
            defaults={
                "name": semester_json["nameZh"],
                "code": semester_json["code"],
                "start_date": datetime.strptime(
                    semester_json["start"], "%Y-%m-%d"
                ).date(),
                "end_date": datetime.strptime(semester_json["end"], "%Y-%m-%d").date(),
            },
        )
        semesters.append(semester)

    return semesters


def load_sections(cache_root: Path, semester: Semester) -> None:
    """Read lesson list JSON for a semester and upsert courses/sections/teachers/admin classes."""
    path = (
        cache_root
        / "catalog"
        / "api"
        / "teach"
        / "lesson"
        / "list-for-teach"
        / f"{semester.jw_id}.json"
    )
    if not path.exists():
        logger.warning(f"Sections list not found for semester {semester.name}: {path}")
        return

    data = json.loads(path.read_text(encoding="utf-8"))

    created_count = updated_count = 0
    total_count = len(data)

    for section_info in tqdm(
        data, desc=f"Sections for {semester.name}", unit="section"
    ):
        with transaction.atomic():
            # Course-level fields
            course = update_or_create_course(section_info)

            # Section
            _, created = update_or_create_section(section_info, semester, course)

            if created:
                created_count += 1
            else:
                updated_count += 1

    logger.info(
        f"Sections processed for {semester.name}: {total_count} (Created: {created_count}, Updated: {updated_count})"
    )


def load_schedules(cache_root: Path, semester: Semester) -> None:
    """For each section of the semester, read jw/api/schedule-table/datum/<jw_id>.json and import."""

    section_ids = list(
        Section.objects.filter(semester=semester).values_list("jw_id", flat=True)
    )

    if not section_ids:
        logger.warning(f"No sections found for semester {semester.name}")
        return

    datum_dir = cache_root / "jw" / "api" / "schedule-table" / "datum"
    for jw_id in tqdm(
        sorted(section_ids), desc=f"Schedules for {semester.name}", unit="section"
    ):
        path = datum_dir / f"{jw_id}.json"

        if not path.exists():
            logger.debug(f"Schedule datum not found for section {jw_id}: {path}")
            continue

        data = json.loads(path.read_text(encoding="utf-8"))

        result = data["result"]
        lesson_list = result["lessonList"]
        schedule_group_list = result["scheduleGroupList"]
        schedule_list = result["scheduleList"]

        # map to section
        section = Section.objects.filter(jw_id=jw_id).first()
        if not section:
            logger.debug(f"Section jw_id {jw_id} not in DB; skipping schedule import")
            continue

        # update teacher ids from lesson_list if present
        teacher_mapping: dict[str, dict] = {}
        for lesson in lesson_list:
            for teacher_data in lesson["teacherAssignmentList"]:
                teacher_mapping[teacher_data["name"]] = teacher_data

        for teacher in section.teachers.all():
            if (teacher_data := teacher_mapping[teacher.name_cn]) is not None:
                teacher.person_id = teacher_data["personId"]
                teacher.teacher_id = teacher_data["teacherId"]
                teacher.save()

        with transaction.atomic():
            # schedule groups for this section
            for group_data in schedule_group_list:
                if group_data["lessonId"] == jw_id:
                    _ = ScheduleGroup.objects.update_or_create(
                        jw_id=group_data["id"],
                        defaults={
                            "section": section,
                            "no": group_data["no"],
                            "limit_count": group_data["limitCount"],
                            "std_count": group_data["stdCount"],
                            "actual_periods": group_data["actualPeriods"],
                            "default": group_data["default"],
                        },
                    )

            # replace schedules for this section
            Schedule.objects.filter(section=section).delete()

            for schedule_data in schedule_list:
                if schedule_data["lessonId"] == jw_id:
                    create_schedule(schedule_data, section)


def update_or_create_course(section_info: dict[str, Any]) -> Course:
    course, _ = Course.objects.update_or_create(
        jw_id=section_info["course"]["id"],
        defaults={
            "education_level": (
                update_or_create_model(
                    EducationLevel,
                    section_info["education"]["cn"],
                    section_info["education"]["en"],
                )
                if section_info["education"]["cn"]
                else None
            ),
            "gradation": (
                update_or_create_model(
                    CourseGradation,
                    section_info["courseGradation"]["cn"],
                    section_info["courseGradation"]["en"],
                )
                if section_info["courseGradation"]["cn"]
                else None
            ),
            "category": (
                update_or_create_model(
                    CourseCategory,
                    section_info["courseCategory"]["cn"],
                    section_info["courseCategory"]["en"],
                )
                if section_info["courseCategory"]["cn"]
                else None
            ),
            "class_type": (
                update_or_create_model(
                    ClassType,
                    section_info["classType"]["cn"],
                    section_info["classType"]["en"],
                )
                if section_info["classType"]["cn"]
                else None
            ),
            "type": (
                update_or_create_model(
                    CourseType,
                    section_info["courseType"]["cn"],
                    section_info["courseType"]["en"],
                )
                if section_info["courseType"]["cn"]
                else None
            ),
            "classify": (
                update_or_create_model(
                    CourseClassify,
                    section_info["courseClassify"]["cn"],
                    section_info["courseClassify"]["en"],
                )
                if section_info["courseClassify"]["cn"]
                else None
            ),
            "code": section_info["course"]["code"],
            "name_cn": section_info["course"]["cn"],
            "name_en": section_info["course"]["en"],
        },
    )

    return course


def update_or_create_section(
    section_info: dict[str, Any],
    semester: Semester,
    course: Course,
) -> tuple[Section, bool]:
    section, created = Section.objects.update_or_create(
        jw_id=section_info["id"],
        defaults={
            "course": course,
            "semester": semester,
            "open_department": (
                update_or_create_department(section_info["openDepartment"])
                if section_info["openDepartment"]
                else None
            ),
            "campus": (
                update_or_create_model(
                    Campus,
                    section_info["campus"]["cn"],
                    section_info["campus"]["en"],
                )
                if section_info["campus"]["cn"]
                else None
            ),
            "exam_mode": (
                update_or_create_model(
                    ExamMode,
                    section_info["examMode"]["cn"],
                    section_info["examMode"]["en"],
                )
                if section_info["examMode"]["cn"]
                else None
            ),
            "teach_language": (
                update_or_create_model(
                    TeachLanguage,
                    section_info["teachLang"]["cn"],
                    section_info["teachLang"]["en"],
                )
                if section_info["teachLang"]["cn"]
                else None
            ),
            "code": section_info["code"],
            "credits": section_info["credits"],
            "period": section_info["period"],
            "periods_per_week": section_info["periodsPerWeek"],
            "std_count": section_info["stdCount"],
            "limit_count": section_info["limitCount"],
            "graduate_and_postgraduate": section_info["graduateAndPostgraduate"],
            "date_time_place_text": section_info["dateTimePlaceText"],
            "date_time_place_person_text": section_info["dateTimePlacePersonText"],
        },
    )

    # Teachers
    teacher_list = []

    for t in section_info["teacherAssignmentList"]:
        department = None

        if dept_code := t["departmentCode"]:
            department = get_or_create_department(dept_code)

        teacher, _ = Teacher.objects.update_or_create(
            name_cn=t["cn"],
            name_en=t["en"],
            department=department,
            defaults={},
        )

        teacher.save()
        teacher_list.append(teacher)

    if teacher_list:
        section.teachers.clear()
        section.teachers.add(*teacher_list)

    # Admin classes
    admin_class_list = []
    for c in section_info["adminClasses"]:
        admin_class, _ = AdminClass.objects.update_or_create(
            name_cn=c["cn"],
            defaults={"name_en": c["en"]},
        )
        admin_class_list.append(admin_class)

    if admin_class_list:
        section.admin_classes.clear()
        section.admin_classes.add(*admin_class_list)

    return section, created


def update_or_create_model(
    model: type,
    name_cn: str,
    name_en: Optional[str] = None,
    **kwargs: Any,
) -> Any:
    result, _ = model.objects.update_or_create(
        name_cn=name_cn,
        defaults={**kwargs, "name_en": name_en or ""},
    )
    return result


def update_or_create_department(dept_json) -> Department:
    department, _ = Department.objects.update_or_create(
        code=dept_json["code"],
        defaults={
            "name_cn": dept_json["cn"],
            "name_en": dept_json["en"],
            "is_college": dept_json["college"],
        },
    )
    return department


def get_or_create_department(code: str) -> Optional[Department]:
    department, _ = Department.objects.get_or_create(
        code=code,
        defaults={"name_cn": f"未知({code})"},
    )

    return department


def update_or_create_room(room_data: dict[str, Any]) -> Room:
    campus, _ = Campus.objects.update_or_create(
        name_cn=room_data["building"]["campus"]["nameZh"],
        defaults={
            "jw_id": room_data["building"]["campus"]["id"],
            "name_en": room_data["building"]["campus"]["nameEn"],
        },
    )

    building, _ = Building.objects.update_or_create(
        jw_id=room_data["building"]["id"],
        defaults={
            "code": room_data["building"]["code"],
            "name_cn": room_data["building"]["nameZh"],
            "name_en": room_data["building"]["nameEn"],
            "campus": campus,
        },
    )
    room_type, _ = RoomType.objects.update_or_create(
        jw_id=room_data["roomType"]["id"],
        defaults={
            "code": room_data["roomType"]["code"],
            "name_cn": room_data["roomType"]["nameZh"],
            "name_en": room_data["roomType"]["nameEn"],
        },
    )

    room, _ = Room.objects.update_or_create(
        jw_id=room_data["id"],
        defaults={
            "code": room_data["code"],
            "name_cn": room_data["nameZh"],
            "name_en": room_data["nameEn"],
            "floor": room_data["floor"],
            "virtual": room_data["virtual"],
            "seats_for_section": room_data["seatsForLesson"],
            "remark": room_data["remark"],
            "seats": room_data["seats"],
            "building": building,
            "room_type": room_type,
        },
    )

    return room


def update_or_create_teacher(
    teacher_id: Optional[int],
    person_id: Optional[int],
    person_name: str,
) -> Teacher:
    teacher = None

    if person_id:
        teacher = Teacher.objects.filter(person_id=person_id).first()

    if not teacher and teacher_id:
        teacher = Teacher.objects.filter(teacher_id=teacher_id).first()

    if not teacher:
        teacher = Teacher.objects.filter(
            name_cn=person_name, teacher_id__isnull=True, person_id__isnull=True
        ).first()

    if not teacher:
        teacher, _ = Teacher.objects.update_or_create(
            person_id=person_id,
            teacher_id=teacher_id,
            name_cn=person_name,
        )
    else:
        if person_id:
            teacher.person_id = person_id
        if teacher_id:
            teacher.teacher_id = teacher_id

        teacher.name_cn = person_name
        teacher.save()

    return teacher


def create_schedule(schedule_data: dict[str, Any], section: Section) -> Schedule:
    room = (
        update_or_create_room(schedule_data["room"]) if schedule_data["room"] else None
    )
    teacher = update_or_create_teacher(
        teacher_id=schedule_data["teacherId"],
        person_id=schedule_data["personId"],
        person_name=(
            schedule_data["personName"] if schedule_data["personName"] else "未知教师"
        ),
    )
    schedule_group = ScheduleGroup.objects.filter(
        jw_id=schedule_data["scheduleGroupId"]
    ).first()

    schedule = Schedule.objects.create(
        section=section,
        schedule_group=schedule_group,
        room=room,
        teacher=teacher,
        periods=schedule_data["periods"],
        date=schedule_data["date"],
        weekday=schedule_data["weekday"],
        start_time=schedule_data["startTime"],
        end_time=schedule_data["endTime"],
        experiment=schedule_data["experiment"],
        custom_place=schedule_data["customPlace"],
        lesson_type=schedule_data["lessonType"],
        week_index=schedule_data["weekIndex"],
        exercise_class=schedule_data["exerciseClass"] or False,
        start_unit=schedule_data["startUnit"],
        end_unit=schedule_data["endUnit"],
    )
    return schedule
