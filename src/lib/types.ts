export type Student = {
  id: string;
  name: string;
  contact: string | null;
  morningDestinationId: string | null;
  afternoonDestinationId: string | null;
  afterSchoolDestinations: Partial<Record<DayOfWeek, string | null>>;
  satMorningDestinationId: string | null;
  satAfternoonDestinationId: string | null;
  grade: string;
  class: string;
  gender: 'Male' | 'Female';
  suggestedMorningDestination?: string | null;
  suggestedAfternoonDestination?: string | null;
  suggestedSatMorningDestination?: string | null;
  suggestedSatAfternoonDestination?: string | null;
  suggestedAfterSchoolDestinations?: Partial<Record<DayOfWeek, string | null>>;
  applicationStatus?: 'pending' | 'reviewed';
  siblingGroupId?: string | null;
};
export type NewStudent = Omit<Student, 'id'>;


export type Bus = {
  id: string;
  name: string;
  capacity: 16 | 29 | 45;
  type: '16-seater' | '29-seater' | '45-seater';
  status?: 'ready' | 'departed';
  departureTime?: string | null;
  isActive?: boolean;
  excludeFromAssignment?: boolean;
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
  notBoarding: string[]; // student IDs
  boarded: string[]; // student IDs
  disembarked?: string[]; // student IDs
  completedDestinations?: string[]; // destination IDs
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

export type LostItem = {
    id: string;
    foundBusId?: string | null;
    foundDate?: string | null;
    itemType?: string | null;
    itemPhotoUrl?: string | null; // Data URI
    status: 'claimed' | 'unclaimed' | 'acknowledged';
}
export type NewLostItem = Omit<LostItem, 'id'>;
