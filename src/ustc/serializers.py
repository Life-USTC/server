from rest_framework import serializers

from .models import *
from .serializers_extra import *


class CampusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campus
        fields = "__all__"


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = "__all__"


class AdminClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminClass
        fields = "__all__"


class TeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teacher
        fields = "__all__"


class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = "__all__"


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = "__all__"
        depth = 1  # Include related objects one level deep


class SectionSerializer(serializers.ModelSerializer):
    ical_url = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = "__all__"
        depth = 1  # Include related objects one level deep

    def get_ical_url(self, obj):
        """Return URL to download this section's schedule as iCalendar"""
        request = self.context.get("request")
        if request is None:
            return None
        return request.build_absolute_uri(f"/api/v1/ustc/section/{obj.id}/ical/")


class TeacherNestedSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)

    class Meta:
        model = Teacher
        fields = ["id", "name_cn", "name_en", "department"]


class ScheduleGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduleGroup
        fields = ["id", "jw_id", "no", "limit_count", "std_count"]


class CourseNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ["id", "code", "name_cn", "name_en"]


class BuildingSerializer(serializers.ModelSerializer):
    campus = CampusSerializer(read_only=True)

    class Meta:
        model = Building
        fields = ["id", "jw_id", "code", "name_cn", "name_en", "campus"]


class RoomSerializer(serializers.ModelSerializer):
    building = BuildingSerializer(read_only=True)

    class Meta:
        model = Room
        fields = [
            "id",
            "jw_id",
            "code",
            "name_cn",
            "name_en",
            "building",
            "floor",
            "seats",
        ]


class ScheduleSerializer(serializers.ModelSerializer):
    room = RoomSerializer(read_only=True)
    teacher = TeacherNestedSerializer(read_only=True)
    schedule_group = ScheduleGroupSerializer(read_only=True)
    group = serializers.SerializerMethodField()
    course = serializers.SerializerMethodField()
    ical_url = serializers.SerializerMethodField()

    class Meta:
        model = Schedule
        fields = [
            "id",
            "date",
            "weekday",
            "start_time",
            "end_time",
            "periods",
            "custom_place",
            "lesson_type",
            "week_index",
            "exercise_class",
            "start_unit",
            "end_unit",
            "room",
            "teacher",
            "schedule_group",
            "group",
            "course",
            "experiment",
            "ical_url",
        ]

    def get_group(self, obj):
        # Keep backward compatibility with frontend that uses 'group' instead of 'schedule_group'
        if obj.schedule_group:
            return ScheduleGroupSerializer(obj.schedule_group).data
        return None

    def get_course(self, obj):
        # Get course information from the related section
        if obj.section and obj.section.course:
            return CourseNestedSerializer(obj.section.course).data
        return None

    def get_ical_url(self, obj):
        """Return URL to download this schedule as iCalendar"""
        request = self.context.get("request")
        if request is None:
            return None
        return request.build_absolute_uri(f"/api/v1/schedules/{obj.id}/ical/")
