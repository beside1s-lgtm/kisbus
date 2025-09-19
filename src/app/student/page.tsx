
import { getBuses, getStudents, getDestinations, getLostItems } from '@/lib/firebase-data';
import { StudentPageContent } from './components/student-page-content';
import { Bus } from '@/lib/types';

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
export default async function StudentPage() {
    const [busesData, students, destinations, lostItems] = await Promise.all([
        getBuses(),
        getStudents(),
        getDestinations(),
        getLostItems(),
    ]);

    return (
        <StudentPageContent 
            initialBuses={sortBuses(busesData)}
            initialStudents={students}
            initialDestinations={destinations}
            initialLostItems={lostItems}
        />
    );
}

    