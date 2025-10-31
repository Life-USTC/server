from django.http import HttpResponse
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework import permissions

from .models import (
    Campus,
    Department,
    AdminClass,
    Teacher,
    Semester,
    Course,
    Schedule,
    Section,
)
from .serializers import (
    CampusSerializer,
    DepartmentSerializer,
    AdminClassSerializer,
    TeacherSerializer,
    SemesterSerializer,
    CourseSerializer,
    ScheduleSerializer,
    SectionSerializer,
)
from .viewsets_extra import (
    EducationLevelViewSet,
    CourseCategoryViewSet,
    CourseClassifyViewSet,
    ClassTypeViewSet,
    CourseTypeViewSet,
    CourseGradationViewSet,
    ExamModeViewSet,
    TeachLanguageViewSet,
)


class CampusViewSet(ModelViewSet):
    queryset = Campus.objects.all()
    serializer_class = CampusSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class DepartmentViewSet(ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class AdminClassViewSet(ModelViewSet):
    queryset = AdminClass.objects.all().order_by("name_cn")
    serializer_class = AdminClassSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class TeacherViewSet(ModelViewSet):
    queryset = Teacher.objects.all()
    serializer_class = TeacherSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class SemesterViewSet(ModelViewSet):
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class CourseViewSet(ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class ScheduleViewSet(ModelViewSet):
    queryset = Schedule.objects.all()
    serializer_class = ScheduleSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def ical(self, request, pk=None):
        """Export a single schedule as iCalendar"""
        schedule = self.get_object()
        ical_content = schedule.to_ical()

        return HttpResponse(
            ical_content,
            content_type="text/calendar",
            headers={
                "Content-Disposition": f'attachment; filename="{schedule.section.code}_schedule_{schedule.start_time}.ics"',
            },
        )


class SectionViewSet(ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def schedules(self, request, pk=None):
        """Get schedules for a specific section using serializer"""
        section = self.get_object()
        schedules = Schedule.objects.filter(section=section).select_related(
            "room",
            "room__building",
            "room__building__campus",
            "teacher",
            "teacher__department",
            "schedule_group",
            "section__course",
        )

        # Use the serializer to format the data
        serializer = ScheduleSerializer(schedules, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def ical(self, request, pk=None):
        """Export section schedules as iCalendar"""
        section = self.get_object()
        ical_content = section.to_ical()

        return HttpResponse(
            ical_content,
            content_type="text/calendar",
            headers={
                "Content-Disposition": f'attachment; filename="{section.code}.ics"',
            },
        )


__all__ = [
    "CampusViewSet",
    "DepartmentViewSet",
    "AdminClassViewSet",
    "TeacherViewSet",
    "SemesterViewSet",
    "CourseViewSet",
    "ScheduleViewSet",
    "SectionViewSet",
    "EducationLevelViewSet",
    "CourseCategoryViewSet",
    "CourseClassifyViewSet",
    "ClassTypeViewSet",
    "CourseTypeViewSet",
    "CourseGradationViewSet",
    "ExamModeViewSet",
    "TeachLanguageViewSet",
]
