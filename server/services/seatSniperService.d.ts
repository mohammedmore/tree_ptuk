export interface TargetSeatInput {
  courseCode: string;
  sec: string;
  courseName?: string;
}

export interface TargetSeatStatus {
  courseCode: string;
  sec: string;
  courseName: string;
  capacity: number;
  registered: number;
  available: number;
  isFull: boolean;
  instructor: string;
  time: string;
  statusText: string;
}

export interface SnipeResult {
  checkedAt: string;
  totalChecked: number;
  openedCount: number;
  openedSeats: TargetSeatStatus[];
  allSeats: TargetSeatStatus[];
  registrationAttempted: boolean;
  registrationResult?: any;
}

export function checkTargetSeatsAvailability(
  targetSeats: TargetSeatInput[],
): Promise<TargetSeatStatus[]>;

export function snipeAndRegister(params: {
  studentId: string;
  password?: string | null;
  targetSeats: TargetSeatInput[];
  autoExecute?: boolean;
  plan?: any;
  semester?: string;
  demoMode?: boolean;
}): Promise<SnipeResult>;

export function sqliteSaveTrackedSeats(
  studentId: string,
  seats: TargetSeatInput[],
): void;
export function sqliteGetTrackedSeats(studentId: string): TargetSeatInput[];
export function sqliteRemoveTrackedSeat(
  studentId: string,
  courseCode: string,
  secNumber: string,
): void;
