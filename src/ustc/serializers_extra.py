from rest_framework import serializers

from .models import *


# BuidlingSerializer & RoomSerializer are moved to avoid circular import


class EducationLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = EducationLevel
        fields = "__all__"


class CourseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseCategory
        fields = "__all__"


class CourseClassifySerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseClassify
        fields = "__all__"


class ClassTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassType
        fields = "__all__"


class CourseTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseType
        fields = "__all__"


class CourseGradationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseGradation
        fields = "__all__"


class ExamModeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamMode
        fields = "__all__"


class TeachLanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeachLanguage
        fields = "__all__"
