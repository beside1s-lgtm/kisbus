import { getBuses, getStudents, getDestinations, getTeachers, getLostItems } from '@/lib/firebase-data';
import type { Bus } from '@/lib/types';
import { TeacherPageContent } from './components/teacher-page-content';

const sortBuses = (buses: Bus[]): Bus[] => {
  return buses.sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ''), 10);
    const numB = parseInt(b.name.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.name.localeCompare(b.name);
  });
};

// This is the Server Component that fetches initial data
export default async function TeacherPage() {
    const [busesData, studentsData, destinationsData, teachersData, lostItemsData] = await Promise.all([
        getBuses(),
        getStudents(),
        getDestinations(),
        getTeachers(),
        getLostItems(),
    ]);

    return (
        <TeacherPageContent
            initialBuses={sortBuses(busesData)}
            initialStudents={studentsData}
            initialDestinations={destinationsData}
            initialTeachers={teachersData}
            initialLostItems={lostItemsData}
        />
    );
}
