from icalendar import Calendar, Event
from datetime import datetime, timedelta
import pytz

# UTC+8 timezone (China Standard Time)
CST = pytz.timezone("Asia/Shanghai")


def create_calendar(name, description=None):
    """
    Create an iCalendar calendar with basic properties
    """
    cal = Calendar()
    cal.add("prodid", "-//USTC Course Schedule//ustc.edu.cn//")
    cal.add("version", "2.0")
    cal.add("name", name)
    cal.add("x-wr-calname", name)

    if description:
        cal.add("description", description)
        cal.add("x-wr-caldesc", description)

    # Set timezone to UTC+8
    cal.add("x-wr-timezone", "Asia/Shanghai")

    return cal


def create_event_from_schedule(schedule):
    """
    Convert a Schedule instance to an iCalendar Event
    """
    event = Event()

    # Create a descriptive summary
    section = schedule.section
    course = section.course
    summary = f"{course.code} {course.name_cn}"

    # Add basic event properties
    event.add("summary", summary)

    # Create unique identifier
    event.add("uid", f"schedule-{schedule.id}@ustc.edu.cn")

    # Get the event date and time
    event_date = schedule.date

    # Convert start_time and end_time (minutes from midnight) to datetime objects
    start_datetime = datetime.combine(event_date, datetime.min.time()) + timedelta(
        minutes=schedule.start_time
    )

    end_datetime = datetime.combine(event_date, datetime.min.time()) + timedelta(
        minutes=schedule.end_time
    )

    # Localize the datetime objects to UTC+8
    start_datetime = CST.localize(start_datetime)
    end_datetime = CST.localize(end_datetime)

    # Add start and end times to event
    event.add("dtstart", start_datetime)
    event.add("dtend", end_datetime)

    # Add location information
    location_parts = []
    if schedule.room:
        if schedule.room.building:
            if schedule.room.building.campus:
                location_parts.append(schedule.room.building.campus.name_cn)
            location_parts.append(schedule.room.building.name_cn)
        location_parts.append(schedule.room.name_cn)
    elif schedule.custom_place:
        location_parts.append(schedule.custom_place)

    if location_parts:
        event.add("location", " ".join(location_parts))

    # Add teacher information to description
    description_parts = []
    if schedule.teacher:
        teacher_name = schedule.teacher.name_cn
        if schedule.teacher.department:
            teacher_name += f" ({schedule.teacher.department.name_cn})"
        description_parts.append(f"教师: {teacher_name}")

    # Add course information to description
    if course.education_level:
        description_parts.append(f"学历层次: {course.education_level.name_cn}")

    if section.credits:
        description_parts.append(f"学分: {section.credits}")

    if schedule.experiment:
        description_parts.append(f"实验: {schedule.experiment}")

    if schedule.lesson_type:
        description_parts.append(f"课程类型: {schedule.lesson_type}")

    # Add section ID information
    description_parts.append(f"课程编号: {section.code}")

    # Add the description to the event
    if description_parts:
        event.add("description", "\n".join(description_parts))

    # Add categories
    categories = []
    if course.category:
        categories.append(course.category.name_cn)
    if course.type:
        categories.append(course.type.name_cn)

    if categories:
        event.add("categories", categories)

    # Set the class as transparent (doesn't block time in availability search)
    event.add("transp", "TRANSPARENT")

    # Add creation timestamp
    event.add("dtstamp", datetime.now(CST))

    return event
