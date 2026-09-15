export const pageInfoFields = /* GraphQL */ `
  page
  pageSize
  total
  totalPages
`;

export const semesterFields = /* GraphQL */ `
  id
  jwId
  code
  nameCn
  startDate
  endDate
`;

export const courseFields = /* GraphQL */ `
  id
  jwId
  code
  nameCn
  nameEn
  category {
    id
    nameCn
    nameEn
  }
  classType {
    id
    nameCn
    nameEn
  }
  educationLevel {
    id
    nameCn
    nameEn
  }
`;

export const sectionFields = /* GraphQL */ `
  id
  jwId
  code
  credits
  period
  periodsPerWeek
  timesPerWeek
  stdCount
  limitCount
  remark
  course {
    id
    jwId
    code
    nameCn
    nameEn
  }
  semester {
    ${semesterFields}
  }
  campus {
    id
    jwId
    code
    nameCn
    nameEn
  }
  openDepartment {
    id
    code
    nameCn
    nameEn
  }
`;

export const teacherFields = /* GraphQL */ `
  id
  jwId
  personId
  code
  nameCn
  nameEn
  email
  telephone
  mobile
  address
  department {
    id
    code
    nameCn
    nameEn
  }
  teacherTitle {
    id
    nameCn
    nameEn
  }
  sectionCount
`;

export const busRouteFields = /* GraphQL */ `
  id
  nameCn
  nameEn
  descriptionPrimary
  stops {
    stopOrder
    campusId
    campusName
  }
`;

export const todoFields = /* GraphQL */ `
  id
  title
  content
  priority
  completed
  dueAt
  createdAt
  updatedAt
`;
