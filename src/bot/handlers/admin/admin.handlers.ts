import { EditCourseHandler } from './courses/edit-course.handler';
import { AssignCourseHandler } from './courses/assign-course.handler';
import { AddMaterialHandler } from './materials/add-material.handler';
import { DeleteMaterialHandler } from './materials/delete-material.handler';
import { AddExamHandler } from './exams/add-exam.handler';
import { DeleteExamHandler } from './exams/delete-exam.handler';
import { PromoteUserHandler } from './users/promote-user.handler';
import { DemoteAdminHandler } from './users/demote-user.handler';
import { AddCourseHandler } from './courses/add-course.handler';
import { ExternalHandler } from './external/external.handler';

export const AdminHandlers = [
  EditCourseHandler,
  AssignCourseHandler,
  AddMaterialHandler,
  DeleteMaterialHandler,
  AddExamHandler,
  DeleteExamHandler,
  PromoteUserHandler,
  DemoteAdminHandler,
  AddCourseHandler,
  EditCourseHandler,
  ExternalHandler,
];
