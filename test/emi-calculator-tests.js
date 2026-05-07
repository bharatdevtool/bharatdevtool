/**
 * EMI Calculator Tests
 * Tests for core EMI calculation logic and amortization schedule generation.
 */

export class EMICalculatorTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.failedTests = [];
  }

  runTest(name, fn) {
    try {
      const result = fn();
      if (result === true) {
        this.passed++;
        console.log(`  ✅ ${name}`);
      } else {
        this.failed++;
        this.failedTests.push(name);
        console.log(`  ❌ ${name} - returned: ${result}`);
      }
    } catch (err) {
      this.failed++;
      this.failedTests.push(name);
      console.log(`  ❌ ${name} - Error: ${err.message}`);
    }
  }

  // ── Core EMI formula ─────────────────────────────────────────────────────────

  calculateEMI(principal, annualRate, tenureMonths) {
    if (principal <= 0 || annualRate <= 0 || tenureMonths <= 0) return null;
    const r = annualRate / 12 / 100;
    return (principal * r * Math.pow(1 + r, tenureMonths)) /
           (Math.pow(1 + r, tenureMonths) - 1);
  }

  buildAmortizationSchedule(principal, annualRate, tenureMonths, emi) {
    const schedule = [];
    const r = annualRate / 12 / 100;
    let balance = principal;
    for (let m = 1; m <= tenureMonths; m++) {
      const interest = balance * r;
      const principalPaid = emi - interest;
      balance = Math.max(0, balance - principalPaid);
      schedule.push({ month: m, emi: Math.round(emi), principal: Math.round(principalPaid), interest: Math.round(interest), balance: Math.round(balance) });
    }
    return schedule;
  }

  approxEqual(a, b, tolerance = 1) {
    return Math.abs(a - b) <= tolerance;
  }

  // ── Tests ────────────────────────────────────────────────────────────────────

  runAllTests() {
    console.log('\n🧪 EMI Calculator Test Suite');
    console.log('============================\n');

    // Basic EMI calculation
    this.runTest('calculateEMI - Home loan 30L @ 8.5% 20yr', () => {
      const emi = this.calculateEMI(3000000, 8.5, 240);
      return this.approxEqual(emi, 26035, 5);
    });

    this.runTest('calculateEMI - Car loan 7L @ 9% 5yr', () => {
      const emi = this.calculateEMI(700000, 9, 60);
      return this.approxEqual(emi, 14527, 5);
    });

    this.runTest('calculateEMI - Personal loan 3L @ 12% 3yr', () => {
      const emi = this.calculateEMI(300000, 12, 36);
      return this.approxEqual(emi, 9964, 5);
    });

    this.runTest('calculateEMI - returns null for zero principal', () => {
      return this.calculateEMI(0, 10, 12) === null;
    });

    this.runTest('calculateEMI - returns null for zero rate', () => {
      return this.calculateEMI(100000, 0, 12) === null;
    });

    this.runTest('calculateEMI - returns null for zero tenure', () => {
      return this.calculateEMI(100000, 10, 0) === null;
    });

    this.runTest('calculateEMI - returns null for negative principal', () => {
      return this.calculateEMI(-100000, 10, 12) === null;
    });

    // Total payment validation
    this.runTest('Total payment = EMI × months', () => {
      const emi = this.calculateEMI(1000000, 10, 120);
      const total = emi * 120;
      const interest = total - 1000000;
      return interest > 0 && total > 1000000;
    });

    this.runTest('Total interest increases with longer tenure', () => {
      const emi10 = this.calculateEMI(1000000, 10, 120);
      const emi20 = this.calculateEMI(1000000, 10, 240);
      return (emi20 * 240 - 1000000) > (emi10 * 120 - 1000000);
    });

    this.runTest('Higher rate increases EMI', () => {
      const emi8 = this.calculateEMI(1000000, 8, 120);
      const emi12 = this.calculateEMI(1000000, 12, 120);
      return emi12 > emi8;
    });

    this.runTest('Longer tenure reduces EMI', () => {
      const emi10 = this.calculateEMI(1000000, 10, 120);
      const emi20 = this.calculateEMI(1000000, 10, 240);
      return emi20 < emi10;
    });

    // Amortization schedule
    this.runTest('Amortization schedule has correct row count', () => {
      const emi = this.calculateEMI(500000, 10, 60);
      const schedule = this.buildAmortizationSchedule(500000, 10, 60, emi);
      return schedule.length === 60;
    });

    this.runTest('Amortization - first month interest correct', () => {
      const principal = 1000000;
      const rate = 12;
      const emi = this.calculateEMI(principal, rate, 120);
      const schedule = this.buildAmortizationSchedule(principal, rate, 120, emi);
      const expectedInterest = Math.round(principal * (rate / 12 / 100));
      return this.approxEqual(schedule[0].interest, expectedInterest, 2);
    });

    this.runTest('Amortization - balance decreases each month', () => {
      const emi = this.calculateEMI(500000, 10, 60);
      const schedule = this.buildAmortizationSchedule(500000, 10, 60, emi);
      for (let i = 1; i < schedule.length; i++) {
        if (schedule[i].balance > schedule[i - 1].balance) return false;
      }
      return true;
    });

    this.runTest('Amortization - final balance is near zero', () => {
      const emi = this.calculateEMI(500000, 10, 60);
      const schedule = this.buildAmortizationSchedule(500000, 10, 60, emi);
      return schedule[schedule.length - 1].balance <= 1;
    });

    this.runTest('Amortization - interest decreases over time', () => {
      const emi = this.calculateEMI(1000000, 12, 120);
      const schedule = this.buildAmortizationSchedule(1000000, 12, 120, emi);
      return schedule[0].interest > schedule[59].interest;
    });

    this.runTest('Amortization - principal portion increases over time', () => {
      const emi = this.calculateEMI(1000000, 12, 120);
      const schedule = this.buildAmortizationSchedule(1000000, 12, 120, emi);
      return schedule[0].principal < schedule[59].principal;
    });

    // Edge cases
    this.runTest('Very short tenure - 1 month', () => {
      const emi = this.calculateEMI(100000, 12, 1);
      return emi !== null && emi > 100000;
    });

    this.runTest('Very large principal - 5 crore', () => {
      const emi = this.calculateEMI(50000000, 8, 240);
      return emi !== null && emi > 0 && emi < 50000000;
    });

    console.log(`\nEMI Calculator: ${this.passed + this.failed} tests (${this.passed} passed, ${this.failed} failed)`);

    return {
      total: this.passed + this.failed,
      passed: this.passed,
      failed: this.failed,
      failedTests: this.failedTests
    };
  }
}
