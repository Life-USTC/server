from django.urls import path

from .views import *

app_name = "ustc"

urlpatterns = [
    # fmt: off
    path("", home, name="home"),
    path("campus/", campus_list, name="campus-list"),
    path("campus/<int:pk>/", campus_detail, name="campus-detail"),
    path("department/", department_list, name="department-list"),
    path("department/<int:pk>/", department_detail, name="department-detail"),
    path("admin-class/", admin_class_list, name="admin-class-list"),
    path("admin-class/<int:pk>/", admin_class_detail, name="admin-class-detail"),
    path("teacher/", teacher_list, name="teacher-list"),
    path("teacher/<int:pk>/", teacher_detail, name="teacher-detail"),
    path("semester/", semester_list, name="semester-list"),
    path("semester/<int:pk>/", semester_detail, name="semester-detail"),
    path("semester/jw-id/<int:jw_id>/",semester_detail_by_jw_id,name="semester-detail-by-jw-id"),
    path("course/", course_list, name="course-list"),
    path("course/<int:pk>/", course_detail, name="course-detail"),
    path("course/jw-id/<int:jw_id>/",course_detail_by_jw_id,name="course-detail-by-jw-id"),
    path("section/", section_list, name="section-list"),
    path("section/<int:pk>/", section_detail, name="section-detail"),
    path("section/<int:pk>/ical/", section_ical, name="section-ical"),
    path("section/jw-id/<int:jw_id>/", section_detail_by_jw_id, name="section-detail-by-jw-id"),
    path("schedule/<int:pk>/ical/", schedule_ical, name="schedule-ical"),
    # fmt: on
]
