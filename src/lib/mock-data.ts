import { Bus, Destination, Student, Route, DayOfWeek, RouteType } from './types';

const destinations: Destination[] = [
  { id: 'dest1', name: 'Gangnam Station' },
  { id: 'dest2', name: 'Jamsil Station' },
  { id: 'dest3', name: 'Samseong Station' },
  { id: 'dest4', name: 'Sinsa Station' },
  { id: 'dest5', name: 'Apgujeong Station' },
];

const students: Student[] = Array.from({ length: 50 }, (_, i) => ({
  id: `student${i + 1}`,
  name: `Student ${i + 1}`,
  destinationId: destinations[i % destinations.length].id,
  grade: `G${(i % 12) + 1}`,
  class: `C${(i % 5) + 1}`,
  gender: i % 2 === 0 ? 'Male' : 'Female',
  isGroupLeader: false,
  daysAsGroupLeader: 0,
}));

const buses: Bus[] = [
  { id: 'bus1', name: 'Bus 01', capacity: 45, type: '45-seater' },
  { id: 'bus2', name: 'Bus 02', capacity: 25, type: '25-seater' },
  { id: 'bus3', name: 'Bus 03', capacity: 15, type: '15-seater' },
];

const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const types: RouteType[] = ['Morning', 'Afternoon'];

const generateInitialSeating = (capacity: number): { seatNumber: number; studentId: string | null }[] => {
  return Array.from({ length: capacity }, (_, i) => ({
    seatNumber: i + 1,
    studentId: null,
  }));
};

const routes: Route[] = buses.flatMap(bus =>
  days.flatMap(day =>
    types.map(type => {
      const routeId = `route-${bus.id}-${day.toLowerCase()}-${type.toLowerCase()}`;
      return {
        id: routeId,
        busId: bus.id,
        dayOfWeek: day,
        type: type,
        stops: destinations.map(d => d.id),
        seating: generateInitialSeating(bus.capacity),
      };
    })
  )
);

// Pre-assign some students for demonstration
const bus1MonMorning = routes.find(r => r.busId === 'bus1' && r.dayOfWeek === 'Monday' && r.type === 'Morning');
if (bus1MonMorning) {
  for (let i = 0; i < 20; i++) {
    bus1MonMorning.seating[i].studentId = students[i].id;
  }
  // Make one a group leader
  const leaderIndex = bus1MonMorning.seating.findIndex(s => s.studentId === students[5].id);
  if (leaderIndex !== -1) {
    const leader = students.find(s => s.id === students[5].id);
    if(leader) {
      leader.isGroupLeader = true;
      leader.daysAsGroupLeader = 10;
    }
  }
}

export const getBuses = async (): Promise<Bus[]> => Promise.resolve(buses);
export const getStudents = async (): Promise<Student[]> => Promise.resolve(students);
export const getDestinations = async (): Promise<Destination[]> => Promise.resolve(destinations);
export const getRoutes = async (): Promise<Route[]> => Promise.resolve(routes);
