from django.contrib import admin

from .models import (
    Campus,
    Department,
    AdminClass,
    Teacher,
    Semester,
    Course,
    Section,
    ScheduleGroup,
    Schedule,
)
from .admin_extra import (
    BuildingAdmin,
    RoomTypeAdmin,
    RoomAdmin,
    EducationLevelAdmin,
    CourseCategoryAdmin,
    CourseClassifyAdmin,
    ClassTypeAdmin,
    CourseTypeAdmin,
    CourseGradationAdmin,
    ExamModeAdmin,
    TeachLanguageAdmin,
)


@admin.register(Campus)
class CampusAdmin(admin.ModelAdmin):
    list_display = ["jw_id", "name_cn", "name_en"]
    search_fields = ["name_cn", "name_en"]


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["code", "name_cn", "name_en", "is_college"]
    list_filter = ["is_college"]
    search_fields = ["code", "name_cn", "name_en"]


@admin.register(AdminClass)
class AdminClassAdmin(admin.ModelAdmin):
    list_display = ["name_cn", "name_en"]
    search_fields = ["name_cn", "name_en"]


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    class TeacherSectionInline(admin.TabularInline):
        model = Section.teachers.through
        verbose_name = "Teaching Section"
        verbose_name_plural = "Teaching Sections"
        extra = 0
        raw_id_fields = ["section"]

        def get_queryset(self, request):
            queryset = super().get_queryset(request)
            return queryset.select_related("section", "teacher").order_by(
                "-section__semester__start_date"
            )

        fields = ["get_section_details"]
        readonly_fields = ["get_section_details"]

        @admin.display(description="Section Details")
        def get_section_details(self, obj):
            section = obj.section
            course = section.course
            semester_name = section.semester.name if section.semester else "N/A"
            credits = section.credits if section.credits else "N/A"
            return f"{section.code} - {course.name_cn} ({semester_name}) - Credits: {credits}"

    list_display = ["name_cn", "name_en", "department", "count_sections"]
    list_filter = ["department"]
    search_fields = ["name_cn", "name_en"]
    inlines = [TeacherSectionInline]
    raw_id_fields = ["department"]
    list_select_related = ["department"]

    @admin.display(description="Sections Count")
    def count_sections(self, obj):
        return obj.sections.count()


@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ["jw_id", "code", "name", "start_date", "end_date"]
    search_fields = ["name"]


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    class CourseSectionInline(admin.TabularInline):
        model = Section
        verbose_name = "Section"
        verbose_name_plural = "Sections"
        extra = 0
        show_change_link = True
        fields = [
            "code",
            "semester",
            "credits",
            "periods_per_week",
            "std_count",
            "limit_count",
        ]
        readonly_fields = [
            "code",
            "semester",
            "credits",
            "periods_per_week",
            "std_count",
            "limit_count",
        ]
        can_delete = False

        def get_queryset(self, request):
            queryset = super().get_queryset(request)
            return queryset.select_related("semester")

    list_display = [
        "code",
        "jw_id",
        "name_cn",
        "name_en",
        "education_level",
        "gradation",
        "category",
        "class_type",
        "type",
        "classify",
    ]
    list_filter = [
        "type",
        "gradation",
        "category",
        "classify",
        "education_level",
        "class_type",
    ]
    search_fields = ["code", "name_cn", "name_en"]
    raw_id_fields = [
        "education_level",
        "gradation",
        "category",
        "class_type",
        "type",
        "classify",
    ]
    list_select_related = [
        "education_level",
        "gradation",
        "category",
        "class_type",
        "type",
        "classify",
    ]
    inlines = [CourseSectionInline]


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    class SectionTeacherInline(admin.TabularInline):
        model = Section.teachers.through
        verbose_name = "Teacher"
        verbose_name_plural = "Teachers"
        extra = 1
        raw_id_fields = ["teacher"]

    class SectionAdminClassInline(admin.TabularInline):
        model = Section.admin_classes.through
        verbose_name = "Admin Class"
        verbose_name_plural = "Admin Classes"
        extra = 1
        raw_id_fields = ["adminclass"]

    class ScheduleGroupInline(admin.TabularInline):
        model = ScheduleGroup
        verbose_name = "Schedule Group"
        verbose_name_plural = "Schedule Groups"
        extra = 0
        fields = ["no", "limit_count", "std_count", "actual_periods", "default"]

    class ScheduleInline(admin.TabularInline):
        model = Schedule
        verbose_name = "Schedule"
        verbose_name_plural = "Schedules"
        extra = 0
        fields = [
            "schedule_group",
            "room",
            "teacher",
            "weekday",
            "start_time",
            "end_time",
            "week_index",
            "exercise_class",
        ]
        raw_id_fields = ["schedule_group", "room", "teacher"]

    list_display = [
        "code",
        "jw_id",
        "get_course_code",
        "get_course_name",
        "semester",
        "credits",
        "periods_per_week",
        "std_count",
        "limit_count",
        "open_department",
        "campus",
        "teach_language",
        "exam_mode",
        "graduate_and_postgraduate",
    ]
    list_filter = [
        "semester",
        "graduate_and_postgraduate",
        "course__type",
        "course__education_level",
        "open_department",
        "campus",
        "exam_mode",
        "teach_language",
    ]
    search_fields = ["code", "course__name_cn", "course__name_en", "course__code"]
    exclude = [
        "teachers",
        "admin_classes",
    ]
    inlines = [
        SectionTeacherInline,
        SectionAdminClassInline,
        ScheduleGroupInline,
        ScheduleInline,
    ]
    raw_id_fields = [
        "course",
        "semester",
        "open_department",
        "campus",
        "exam_mode",
        "teach_language",
    ]
    list_select_related = [
        "course",
        "semester",
        "open_department",
        "campus",
        "exam_mode",
        "teach_language",
    ]

    @admin.display(description="Course Code", ordering="course__code")
    def get_course_code(self, obj):
        return obj.course.code

    @admin.display(description="Course Name", ordering="course__name_cn")
    def get_course_name(self, obj):
        return obj.course.name_cn


@admin.register(ScheduleGroup)
class ScheduleGroupAdmin(admin.ModelAdmin):
    list_display = [
        "section",
        "no",
        "limit_count",
        "std_count",
        "actual_periods",
        "default",
    ]
    list_filter = ["default"]
    search_fields = [
        "section__code",
        "section__course__name_cn",
        "section__course__name_en",
    ]
    raw_id_fields = ["section"]
    list_select_related = ["section", "section__course"]


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    raw_id_fields = ["section", "schedule_group", "room", "teacher"]
    list_display = [
        "section",
        "schedule_group",
        "room",
        "teacher",
        "periods",
        "date",
        "weekday",
        "start_time",
        "end_time",
        "week_index",
        "exercise_class",
    ]
    list_filter = ["room", "weekday", "exercise_class"]
    search_fields = [
        "section__code",
        "section__course__name_cn",
        "section__course__name_en",
    ]
    list_select_related = [
        "section",
        "schedule_group",
        "room",
        "teacher",
        "section__course",
    ]


__all__ = [
    "CampusAdmin",
    "DepartmentAdmin",
    "AdminClassAdmin",
    "TeacherAdmin",
    "SemesterAdmin",
    "CourseAdmin",
    "SectionAdmin",
    "ScheduleGroupAdmin",
    "ScheduleAdmin",
    "BuildingAdmin",
    "RoomTypeAdmin",
    "RoomAdmin",
    "EducationLevelAdmin",
    "CourseCategoryAdmin",
    "CourseClassifyAdmin",
    "ClassTypeAdmin",
    "CourseTypeAdmin",
    "CourseGradationAdmin",
    "ExamModeAdmin",
    "TeachLanguageAdmin",
]
