"""
API v1 URL configuration.

This module handles all API v1 routes for different apps.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .viewsets import (
    CampusViewSet,
    DepartmentViewSet,
    AdminClassViewSet,
    TeacherViewSet,
    SemesterViewSet,
    CourseViewSet,
    SectionViewSet,
    ScheduleViewSet,
)

router = DefaultRouter()
router.register(r"campus", CampusViewSet, basename="campus")
router.register(r"department", DepartmentViewSet, basename="department")
router.register(r"admin-class", AdminClassViewSet, basename="admin-class")
router.register(r"teacher", TeacherViewSet, basename="teacher")
router.register(r"semester", SemesterViewSet, basename="semester")
router.register(r"course", CourseViewSet, basename="course")
router.register(r"section", SectionViewSet, basename="section")
router.register(r"schedule", ScheduleViewSet, basename="schedule")

urlpatterns = [
    path("", include(router.urls)),
]
