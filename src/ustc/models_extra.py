from django.db import models


class Building(models.Model):
    """
    教学楼
    """

    # fmt: off
    jw_id = models.IntegerField(unique=True)
    name_cn = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100, blank=True, null=True)
    code = models.CharField(max_length=20)
    campus = models.ForeignKey("Campus", on_delete=models.SET_NULL, blank=True, null=True)
    # fmt: on

    def __str__(self):
        return self.name_cn

    class Meta:
        verbose_name_plural = "Buildings"


class RoomType(models.Model):
    """
    教室类型
    """

    # fmt: off
    jw_id = models.IntegerField(unique=True)
    name_cn = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100, blank=True, null=True)
    code = models.CharField(max_length=20)
    # fmt: on

    def __str__(self):
        return self.name_cn

    class Meta:
        verbose_name_plural = "Room Types"


class Room(models.Model):
    """
    教室
    """

    # fmt: off
    jw_id = models.IntegerField(unique=True)
    code = models.CharField(max_length=20)
    building = models.ForeignKey(Building, on_delete=models.SET_NULL, blank=True, null=True)
    room_type = models.ForeignKey(RoomType, on_delete=models.SET_NULL, blank=True, null=True)

    name_cn = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100, blank=True, null=True)
    floor = models.IntegerField()
    virtual = models.BooleanField(default=False)
    seats_for_section = models.IntegerField()
    remark = models.TextField(blank=True, null=True)
    seats = models.IntegerField()
    # fmt: on

    def __str__(self):
        return self.name_cn

    class Meta:
        verbose_name_plural = "Rooms"


class EducationLevel(models.Model):
    """
    学历层次：
    本科生
    研究生
    本研贯通
    """

    # fmt: off
    name_cn = models.CharField(max_length=50, unique=True)
    name_en = models.CharField(max_length=50, blank=True, null=True)
    # fmt: on

    def __str__(self):
        return self.name_cn if self.name_cn else self.name_en or ""

    class Meta:
        verbose_name_plural = "Education Levels"
        ordering = ["name_cn"]


class CourseCategory(models.Model):
    """
    课程类别：
    本科计划内课程
    """

    # fmt: off
    name_cn = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, blank=True, null=True)
    # fmt: on

    def __str__(self):
        return self.name_cn if self.name_cn else self.name_en or ""

    class Meta:
        verbose_name_plural = "Course Categories"
        ordering = ["name_cn"]


class CourseClassify(models.Model):
    """
    课程范畴分类：
    科技与人文
    """

    # fmt: off
    name_cn = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, blank=True, null=True)
    # fmt: on

    def __str__(self):
        return self.name_cn if self.name_cn else self.name_en or ""

    class Meta:
        verbose_name_plural = "Course Classifies"
        ordering = ["name_cn"]


class ClassType(models.Model):
    """
    课堂类型：
    本科生课堂类型
    （暂无）
    研究生课堂类型
    基础
    专业
    """

    # fmt: off
    name_cn = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, blank=True, null=True)
    # fmt: on

    def __str__(self):
        return self.name_cn if self.name_cn else self.name_en or ""

    class Meta:
        verbose_name_plural = "Class Types"
        ordering = ["name_cn"]


class CourseType(models.Model):
    """
    课程类型：
    理论实验课
    """

    name_cn = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return self.name_cn if self.name_cn else self.name_en or "Unnamed Course Type"

    class Meta:
        verbose_name_plural = "Course Types"
        ordering = ["name_cn"]


class CourseGradation(models.Model):
    """
    课程层次：
    专业选修
    """

    name_cn = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return (
            self.name_cn if self.name_cn else self.name_en or "Unnamed Course Gradation"
        )

    class Meta:
        verbose_name_plural = "Course Gradations"
        ordering = ["name_cn"]


class ExamMode(models.Model):
    """
    考试方式：
    大作业（论文、报告、项目或作品等）
    """

    name_cn = models.CharField(max_length=200, unique=True)
    name_en = models.CharField(max_length=200, blank=True, null=True)

    def __str__(self):
        return self.name_cn if self.name_cn else self.name_en or "Unnamed Exam Mode"

    class Meta:
        verbose_name_plural = "Exam Modes"
        ordering = ["name_cn"]


class TeachLanguage(models.Model):
    """
    授课语言：
    中文
    """

    name_cn = models.CharField(max_length=50, unique=True)
    name_en = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return (
            self.name_cn if self.name_cn else self.name_en or "Unnamed Teach Language"
        )

    class Meta:
        verbose_name_plural = "Teach Languages"
        ordering = ["name_cn"]
