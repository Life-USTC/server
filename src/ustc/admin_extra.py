from django.contrib import admin
from django.db.models.functions import Cast

from .models import *


@admin.register(Building)
class BuildingAdmin(admin.ModelAdmin):
    list_display = ["jw_id", "code", "campus", "name_cn", "name_en"]
    search_fields = ["name_cn", "name_en"]
    list_select_related = ["campus"]

    def get_queryset(self, request):
        queryset = super().get_queryset(request)

        return queryset.annotate(
            code_as_int=Cast("code", output_field=models.IntegerField())
        ).order_by("code_as_int")


@admin.register(RoomType)
class RoomTypeAdmin(admin.ModelAdmin):
    list_display = ["code", "name_cn", "name_en"]
    search_fields = ["name_cn", "name_en"]


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = [
        "jw_id",
        "name_cn",
        "name_en",
        "code",
        "building",
        "room_type",
        "floor",
        "virtual",
        "seats_for_section",
        "seats",
    ]
    list_filter = ["building", "room_type", "virtual"]
    search_fields = ["name_cn", "name_en", "code"]
    raw_id_fields = ["building", "room_type"]
    list_select_related = ["building", "room_type"]


@admin.register(EducationLevel)
class EducationLevelAdmin(admin.ModelAdmin):
    list_display = ["name_cn", "name_en"]
    search_fields = ["name_cn", "name_en"]


@admin.register(CourseCategory)
class CourseCategoryAdmin(admin.ModelAdmin):
    list_display = ["name_cn", "name_en"]
    search_fields = ["name_cn", "name_en"]


@admin.register(CourseClassify)
class CourseClassifyAdmin(admin.ModelAdmin):
    list_display = ["name_cn", "name_en"]
    search_fields = ["name_cn", "name_en"]


@admin.register(ClassType)
class ClassTypeAdmin(admin.ModelAdmin):
    list_display = ["name_cn", "name_en"]
    search_fields = ["name_cn", "name_en"]


@admin.register(CourseType)
class CourseTypeAdmin(admin.ModelAdmin):
    list_display = ["name_cn", "name_en"]
    search_fields = ["name_cn", "name_en"]


@admin.register(CourseGradation)
class CourseGradationAdmin(admin.ModelAdmin):
    list_display = ["name_cn", "name_en"]
    search_fields = ["name_cn", "name_en"]


@admin.register(ExamMode)
class ExamModeAdmin(admin.ModelAdmin):
    list_display = ["name_cn", "name_en"]
    search_fields = ["name_cn", "name_en"]


@admin.register(TeachLanguage)
class TeachLanguageAdmin(admin.ModelAdmin):
    list_display = ["name_cn", "name_en"]
    search_fields = ["name_cn", "name_en"]
