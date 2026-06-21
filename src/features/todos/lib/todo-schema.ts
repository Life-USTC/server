import * as z from "zod";
import { TODO_PRIORITY_VALUES } from "./todo-priority";

export const todoPrioritySchema = z.enum(TODO_PRIORITY_VALUES);
