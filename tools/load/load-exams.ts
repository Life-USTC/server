import type {
  Exam,
  ExamBatch,
  PrismaClient,
  Section,
} from "../../src/generated/prisma-node/client";
import { parseDateInput } from "../../src/lib/time/parse-date-input";

interface ExamBatchInterface {
  id: number;
  name: string;
}

interface ExamRoomInterface {
  room: string;
  count: number;
}

interface ExamInterface {
  id: number;
  examType: number;
  startTime: number;
  endTime: number;
  examBatch: ExamBatchInterface;
  examDate: string;
  examRooms: ExamRoomInterface[];
  examTakeCount: number;
  examMode: string;
  lesson: {
    id: number;
  };
  grades: string;
  adminclasseNames: string;
}

export type ExamDataInterface = ExamInterface[];

async function loadExamBatch(
  data: ExamBatchInterface,
  prisma: PrismaClient,
): Promise<ExamBatch> {
  const examBatch = await prisma.examBatch.upsert({
    where: { nameCn: data.name },
    update: {
      nameCn: data.name,
    },
    create: {
      nameCn: data.name,
    },
  });
  return examBatch;
}

async function loadSectionById(
  id: number,
  prisma: PrismaClient,
): Promise<Section | null> {
  const section = await prisma.section.findUnique({
    where: { jwId: id },
  });
  return section;
}

export async function loadExams(
  data: ExamDataInterface,
  prisma: PrismaClient,
): Promise<Exam[]> {
  const exams = [];

  for (const examJson of data) {
    const examDate = parseDateInput(examJson.examDate);
    if (examDate === undefined) {
      console.warn(
        `[load-exams] Invalid exam date for exam jwId=${examJson.id}, examDate=${examJson.examDate}`,
      );
      continue;
    }

    const examBatch = await loadExamBatch(examJson.examBatch, prisma);
    const section = await loadSectionById(examJson.lesson.id, prisma);

    if (!section) {
      console.warn(
        `Section with jwId ${examJson.lesson.id} not found, skipping exam ${examJson.id}`,
      );
      continue;
    }

    // Create the exam first
    const exam = await prisma.exam.upsert({
      where: { jwId: examJson.id },
      update: {
        examType: examJson.examType,
        startTime: examJson.startTime,
        endTime: examJson.endTime,
        examDate,
        examTakeCount: examJson.examTakeCount,
        examMode: examJson.examMode,
        examBatchId: examBatch.id,
        sectionId: section.id,
      },
      create: {
        jwId: examJson.id,
        examType: examJson.examType,
        startTime: examJson.startTime,
        endTime: examJson.endTime,
        examDate,
        examTakeCount: examJson.examTakeCount,
        examMode: examJson.examMode,
        examBatchId: examBatch.id,
        sectionId: section.id,
      },
    });

    // Clear existing exam rooms
    await prisma.examRoom.deleteMany({
      where: { examId: exam.id },
    });

    // Create exam rooms
    await Promise.all(
      examJson.examRooms.map((roomJson) =>
        prisma.examRoom.create({
          data: {
            room: roomJson.room,
            count: roomJson.count,
            examId: exam.id,
          },
        }),
      ),
    );

    exams.push(exam);
  }

  return exams;
}
