
export type Student = {
  id: string;
  name: string;
  morningDestinationId: string | null;
  afternoonDestinationId: string | null;
  afterSchoolDestinations: Partial<Record<DayOfWeek, string | null>>;
  grade: string;
  class: string;
  gender: 'Male' | 'Female';
  isGroupLeader?: boolean;
  daysAsGroupLeader: number;
  groupLeaderStartDate?: string;
  groupLeaderEndDate?: string;
  suggestedMorningDestination?: string | null;
  suggestedAfternoonDestination?: string | null;
  suggestedAfterSchoolDestinations?: Partial<Record<DayOfWeek, string | null>>;
};
export type NewStudent = Omit<Student, 'id' | 'isGroupLeader' | 'daysAsGroupLeader'>;


export type Bus = {
  id: string;
  name: string;
  capacity: 15 | 29 | 45;
  type: '15-seater' | '29-seater' | '45-seater';
};
export type NewBus = Omit<Bus, 'id'>;

export type Destination = {
  id: string;
  name:string;
};
export type NewDestination = Omit<Destination, 'id'>;

export type Teacher = {
    id: string;
    name: string;
};
export type NewTeacher = Omit<Teacher, 'id'>;


export type SeatingAssignment = {
  seatNumber: number;
  studentId: string | null;
};

export type Route = {
  id: string;
  busId: string;
  dayOfWeek: DayOfWeek;
  type: RouteType;
  stops: string[]; // ordered list of destination IDs
  seating: SeatingAssignment[];
  teacherIds?: string[];
};

export type AttendanceRecord = {
  id: string; // YYYY-MM-DD
  routeId: string;
  absent: string[]; // student IDs
  boarded: string[]; // student IDs
};

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export type RouteType = 'Morning' | 'Afternoon' | 'AfterSchool';

export type GroupLeaderRecord = {
    studentId: string;
    name: string;
    startDate: string;
    endDate: string | null;
    days: number;
}
