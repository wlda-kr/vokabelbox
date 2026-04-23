export type Grade = 1 | 2 | 3 | 4 | 5 | 6;

export type GradeResult = {
  grade: Grade;
  label: string;
};

export function calculateGrade(percentage: number): GradeResult {
  if (percentage >= 92) return { grade: 1, label: "Sehr gut" };
  if (percentage >= 80) return { grade: 2, label: "Gut" };
  if (percentage >= 66) return { grade: 3, label: "Befriedigend" };
  if (percentage >= 50) return { grade: 4, label: "Ausreichend" };
  if (percentage >= 25) return { grade: 5, label: "Mangelhaft" };
  return { grade: 6, label: "Ungenügend" };
}
