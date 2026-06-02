import { db } from './packages/db/src';
import { checkIn } from './packages/services/src/hr/attendance-service';

async function test() {
  const ctx = {
    userId: 'test_user',
    tenantId: 'default',
    locationId: 'test_loc',
  };

  try {
    const res = await checkIn(
      {
        employeeId: 'test_employee',
        method: 'gps',
        gpsData: { lat: 1, lng: 1, accuracy_m: 10 },
        performedAt: new Date().toISOString()
      },
      ctx
    );
    console.log("CAUSE:", (res as any).error?.cause?.cause);
  } catch (e) {
  }
}

test();
