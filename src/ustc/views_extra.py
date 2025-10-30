from django.shortcuts import render, get_object_or_404
from django.core.paginator import Paginator
from rest_framework import viewsets
from .models_extra import *
from .serializers import *


def generic_list_view(
    request, model_class, template_name, context_object_name, paginate_by=50
):
    """Generic function for list views"""
    queryset = model_class.objects.all()

    # Handle search
    search_query = request.GET.get("q", "")
    if search_query:
        # This is a simplified search that assumes models have name_cn, name_en or name fields
        # In a real application, you'd customize this per model
        if hasattr(model_class, "name_cn"):
            queryset = queryset.filter(name_cn__icontains=search_query)
        elif hasattr(model_class, "name_en"):
            queryset = queryset.filter(name_en__icontains=search_query)
        elif hasattr(model_class, "name"):
            queryset = queryset.filter(name__icontains=search_query)
        elif hasattr(model_class, "code"):
            queryset = queryset.filter(code__icontains=search_query)

    paginator = Paginator(queryset, paginate_by)
    page_number = request.GET.get("page", 1)
    page_obj = paginator.get_page(page_number)

    context = {
        context_object_name: page_obj,
        "page_obj": page_obj,
        "search_query": search_query,
    }
    return render(request, template_name, context)


def generic_detail_view(
    request, model_class, template_name, context_object_name, pk=None, jw_id=None
):
    """Generic function for detail views"""
    if pk:
        obj = get_object_or_404(model_class, pk=pk)
    elif jw_id:
        obj = get_object_or_404(model_class, jw_id=jw_id)
    else:
        return render(request, "404.html.jinja", {}, status=404)

    context = {context_object_name: obj}
    return render(request, template_name, context)


class CourseTypeViewSet(viewsets.ModelViewSet):
    queryset = CourseType.objects.all()
    serializer_class = CourseTypeSerializer


class CourseGradationViewSet(viewsets.ModelViewSet):
    queryset = CourseGradation.objects.all()
    serializer_class = CourseGradationSerializer


class CourseCategoryViewSet(viewsets.ModelViewSet):
    queryset = CourseCategory.objects.all()
    serializer_class = CourseCategorySerializer


class CourseClassifyViewSet(viewsets.ModelViewSet):
    queryset = CourseClassify.objects.all()
    serializer_class = CourseClassifySerializer


class ExamModeViewSet(viewsets.ModelViewSet):
    queryset = ExamMode.objects.all()
    serializer_class = ExamModeSerializer


class TeachLanguageViewSet(viewsets.ModelViewSet):
    queryset = TeachLanguage.objects.all()
    serializer_class = TeachLanguageSerializer


class EducationLevelViewSet(viewsets.ModelViewSet):
    queryset = EducationLevel.objects.all()
    serializer_class = EducationLevelSerializer


class ClassTypeViewSet(viewsets.ModelViewSet):
    queryset = ClassType.objects.all()
    serializer_class = ClassTypeSerializer


def course_type_list(request):
    return generic_list_view(
        request, CourseType, "ustc/course_type_list.html.jinja", "course_types"
    )


def course_gradation_list(request):
    return generic_list_view(
        request,
        CourseGradation,
        "ustc/course_gradation_list.html.jinja",
        "course_gradations",
    )


def course_category_list(request):
    return generic_list_view(
        request,
        CourseCategory,
        "ustc/course_category_list.html.jinja",
        "course_categories",
    )


def course_classify_list(request):
    return generic_list_view(
        request,
        CourseClassify,
        "ustc/course_classify_list.html.jinja",
        "course_classifies",
    )


def exam_mode_list(request):
    return generic_list_view(
        request, ExamMode, "ustc/exam_mode_list.html.jinja", "exam_modes"
    )


def teach_language_list(request):
    return generic_list_view(
        request, TeachLanguage, "ustc/teach_language_list.html.jinja", "teach_languages"
    )


def education_level_list(request):
    return generic_list_view(
        request,
        EducationLevel,
        "ustc/education_level_list.html.jinja",
        "education_levels",
    )


def class_type_list(request):
    return generic_list_view(
        request, ClassType, "ustc/class_type_list.html.jinja", "class_types"
    )
