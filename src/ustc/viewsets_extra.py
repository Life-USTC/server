from rest_framework.viewsets import ModelViewSet
from rest_framework import permissions

from .models import (
    EducationLevel,
    CourseCategory,
    CourseClassify,
    ClassType,
    CourseType,
    CourseGradation,
    ExamMode,
    TeachLanguage,
)
from .serializers import (
    EducationLevelSerializer,
    CourseCategorySerializer,
    CourseClassifySerializer,
    ClassTypeSerializer,
    CourseTypeSerializer,
    CourseGradationSerializer,
    ExamModeSerializer,
    TeachLanguageSerializer,
)


class EducationLevelViewSet(ModelViewSet):
    queryset = EducationLevel.objects.all()
    serializer_class = EducationLevelSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class CourseCategoryViewSet(ModelViewSet):
    queryset = CourseCategory.objects.all()
    serializer_class = CourseCategorySerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class CourseClassifyViewSet(ModelViewSet):
    queryset = CourseClassify.objects.all()
    serializer_class = CourseClassifySerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class ClassTypeViewSet(ModelViewSet):
    queryset = ClassType.objects.all()
    serializer_class = ClassTypeSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class CourseTypeViewSet(ModelViewSet):
    queryset = CourseType.objects.all()
    serializer_class = CourseTypeSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class CourseGradationViewSet(ModelViewSet):
    queryset = CourseGradation.objects.all()
    serializer_class = CourseGradationSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class ExamModeViewSet(ModelViewSet):
    queryset = ExamMode.objects.all()
    serializer_class = ExamModeSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class TeachLanguageViewSet(ModelViewSet):
    queryset = TeachLanguage.objects.all()
    serializer_class = TeachLanguageSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
