from django.db import models
from datetime import date

from .models_extra import *
from .ical_utils import create_calendar, create_event_from_schedule


class Campus(models.Model):
    """
    校区
    """

    # fmt: off
    jw_id = models.IntegerField(unique=True, blank=True, null=True)

    name_cn = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, blank=True, null=True)
    # fmt: on

    def __str__(self):
        return self.name_cn if self.name_cn else self.name_en or "Unnamed Campus"

    class Meta:
        verbose_name_plural = "Campuses"
        ordering = ["name_cn"]


class Department(models.Model):
    """
    开课单位
    """

    # fmt: off
    code = models.CharField(max_length=20, unique=True)
    name_cn = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, blank=True, null=True)
    is_college = models.BooleanField(default=False)
    # fmt: on

    def __str__(self):
        return self.name_cn if self.name_cn else self.name_en or "Unnamed Department"

    class Meta:
        verbose_name_plural = "Departments"
        ordering = ["code"]


class AdminClass(models.Model):
    """
    行政班
    """

    # fmt: off
    name_cn = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, blank=True, null=True)
    # fmt: on

    def __str__(self):
        return self.name_cn

    class Meta:
        verbose_name_plural = "Admin Classes"
        ordering = ["name_cn"]


class Teacher(models.Model):
    """
    教师
    """

    # fmt: off
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, blank=True, null=True)
    
    name_cn = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100, blank=True, null=True)
    teacher_id = models.IntegerField(blank=True, null=True)
    person_id = models.IntegerField(blank=True, null=True)
    # fmt: on

    def __str__(self):
        return self.name_cn

    class Meta:
        verbose_name_plural = "Teachers"
        ordering = ["name_cn"]


class Semester(models.Model):
    """
    学期
    """

    # fmt: off
    jw_id = models.IntegerField(unique=True)
    
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=20, unique=True)
    start_date = models.DateField(null=True)
    end_date = models.DateField(null=True)
    # fmt: on

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Semesters"
        ordering = ["-start_date"]

    def is_current(self):
        """Determine if the semester is the current semester."""
        today = date.today()
        return (
            self.start_date <= today <= self.end_date
            if self.start_date and self.end_date
            else False
        )

    def is_finished(self):
        """Determine if the semester is finished."""
        today = date.today()
        return self.end_date < today if self.end_date else False


class Course(models.Model):
    """
    课程

    此项记录课程本身的信息（不随开课学期而发生变化的信息）
    """

    # fmt: off
    jw_id = models.IntegerField(unique=True)
    
    education_level = models.ForeignKey(EducationLevel, on_delete=models.SET_NULL, blank=True, null=True)
    category = models.ForeignKey(CourseCategory, on_delete=models.SET_NULL, blank=True, null=True)
    classify = models.ForeignKey(CourseClassify, on_delete=models.SET_NULL, blank=True, null=True)
    class_type = models.ForeignKey(ClassType, on_delete=models.SET_NULL, blank=True, null=True)
    gradation = models.ForeignKey(CourseGradation, on_delete=models.SET_NULL, blank=True, null=True)
    type = models.ForeignKey(CourseType, on_delete=models.SET_NULL, blank=True, null=True)
    
    code = models.CharField(max_length=20)
    name_cn = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    # fmt: on

    def __str__(self):
        return f"{self.code} - {self.name_cn}"

    class Meta:
        verbose_name_plural = "Courses"
        ordering = ["code"]


class Section(models.Model):
    """
    开课信息
    """

    # fmt: off
    jw_id = models.IntegerField(unique=True)

    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    semester = models.ForeignKey(Semester, on_delete=models.SET_NULL, blank=True, null=True)
    
    campus = models.ForeignKey(Campus, on_delete=models.SET_NULL, blank=True, null=True)
    open_department = models.ForeignKey(Department, on_delete=models.SET_NULL, blank=True, null=True)
    admin_classes = models.ManyToManyField(AdminClass, related_name="sections")
    teachers = models.ManyToManyField(Teacher, related_name="sections")
    
    exam_mode = models.ForeignKey(ExamMode, on_delete=models.SET_NULL, blank=True, null=True)
    teach_language = models.ForeignKey(TeachLanguage, on_delete=models.SET_NULL, blank=True, null=True)

    code = models.CharField(max_length=20)
    credits = models.FloatField(blank=True, null=True)  # 学分
    period = models.IntegerField(blank=True, null=True)  # 学时
    periods_per_week = models.IntegerField(blank=True, null=True)  # 每周学时
    std_count = models.IntegerField(blank=True, null=True)  # 选课人数
    limit_count = models.IntegerField(blank=True, null=True)  # 限选人数
    graduate_and_postgraduate = models.BooleanField(blank=True, null=True)  # 是否本研贯通
    date_time_place_text = models.TextField(blank=True, null=True)
    date_time_place_person_text = models.JSONField(blank=True, null=True)
    # fmt: on

    def __str__(self):
        return f"{self.code} - {self.course.name_cn} - {s.name if (s := self.semester) else ''}"

    def to_ical(self):
        """
        Convert the section's schedule to an iCalendar format
        Returns a string in iCalendar format
        """

        # Create calendar
        cal_name = f"{self.course.code} {self.course.name_cn}"
        description = f"Course: {self.course.name_cn} ({self.code})"
        if self.semester:
            description += f" - {self.semester.name}"

        cal = create_calendar(cal_name, description)

        # Add all schedules as events
        schedules = Schedule.objects.filter(section=self)
        for schedule in schedules:
            event = create_event_from_schedule(schedule)
            cal.add_component(event)

        return cal.to_ical().decode("utf-8")

    class Meta:
        verbose_name_plural = "Sections"
        ordering = ["code", "semester__start_date"]


class ScheduleGroup(models.Model):
    """
    排课组
    """

    # fmt: off
    jw_id = models.IntegerField(unique=True)

    section = models.ForeignKey(Section, on_delete=models.CASCADE)

    no = models.IntegerField()
    limit_count = models.IntegerField()
    std_count = models.IntegerField()
    actual_periods = models.IntegerField()
    default = models.BooleanField(default=False)
    # fmt: on

    def __str__(self):
        return f"Group {self.no} for Lesson {self.section.code}"

    class Meta:
        verbose_name_plural = "Schedule Groups"


class Schedule(models.Model):
    """
    排课信息
    """

    # fmt: off
    section = models.ForeignKey(Section, on_delete=models.CASCADE)
    schedule_group = models.ForeignKey(ScheduleGroup, on_delete=models.CASCADE)
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, blank=True, null=True)
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, blank=True, null=True)

    periods = models.IntegerField()
    date = models.DateField()
    weekday = models.IntegerField()
    start_time = models.IntegerField()
    end_time = models.IntegerField()
    experiment = models.TextField(blank=True, null=True)
    custom_place = models.TextField(blank=True, null=True)
    lesson_type = models.TextField(blank=True, null=True)
    week_index = models.IntegerField()
    exercise_class = models.BooleanField(default=False)
    start_unit = models.IntegerField()
    end_unit = models.IntegerField()
    # fmt: on

    def __str__(self):
        return f"Schedule for Section {self.section.code} on {self.date}"

    def to_ical(self):
        """
        Convert this schedule to an iCalendar format
        Returns a string in iCalendar format
        """
        from .ical_utils import create_calendar, create_event_from_schedule

        # Create calendar
        cal_name = (
            f"{self.section.course.code} {self.section.course.name_cn} - {self.date}"
        )
        description = f"Schedule for {self.section.code} on {self.date}"

        cal = create_calendar(cal_name, description)

        # Add this schedule as an event
        event = create_event_from_schedule(self)
        cal.add_component(event)

        return cal.to_ical().decode("utf-8")

    class Meta:
        verbose_name_plural = "Schedules"
