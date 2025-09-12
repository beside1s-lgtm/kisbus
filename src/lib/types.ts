export type Student = {
  id: string;
  name: string;
  destinationId: string;
  grade: string;
  class: string;
  gender: 'Male' | 'Female';
  isGroupLeader: boolean;
  daysAsGroupLeader: number;
};

export type Bus = {
  id: string;
  name: string;
  capacity: 15 | 25 | 45;
  type: '15-seater' | '25-seater' | '45-seater';
};

export type Destination = {
  id: string;
  name: string;
};

export type SeatingAssignment = {
  seatNumber: number;
  studentId: string | null;
};

export type Route = {
  id: string;
  busId: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  type: 'Morning' | 'Afternoon';
  stops: string[]; // ordered list of destination IDs
  seating: SeatingAssignment[];
};

export type AttendanceRecord = {
  routeId: string;
  date: string; // YYYY-MM-DD
  absent: string[]; // student IDs
  boarded: string[]; // student IDs
};

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export type RouteType = 'Morning' | 'Afternoon';
