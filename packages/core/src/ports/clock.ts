export interface IClockPort {
  now(): Date;
}

export class SystemClock implements IClockPort {
  now(): Date {
    return new Date();
  }
}
