export type StudentDto = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  birthDate: string;
  gender: string | null;
  documentNumber: string | null;
};

export function presentStudent(row: {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  gender: string | null;
  documentNumber: string | null;
}): StudentDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    name: `${row.firstName} ${row.lastName}`.trim(),
    birthDate: row.birthDate.toISOString().slice(0, 10),
    gender: row.gender,
    documentNumber: row.documentNumber,
  };
}
