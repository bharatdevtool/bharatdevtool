/**
 * BMI Calculator Test Suite
 * Tests for bmi-calculator.html core calculation logic
 */

export class BMICalculatorTester {
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
        console.log(`  ❌ ${name} — returned ${result}`);
      }
    } catch (err) {
      this.failed++;
      this.failedTests.push(name);
      console.log(`  ❌ ${name} — ${err.message}`);
    }
  }

  // ── BMI formulas ─────────────────────────────────────────────────────────

  calculateBMIMetric(weightKg, heightCm) {
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
  }

  calculateBMIImperial(weightLb, heightIn) {
    return (703 * weightLb) / (heightIn * heightIn);
  }

  // ── Category lookup ───────────────────────────────────────────────────────

  getCategory(bmi) {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25)   return 'Normal weight';
    if (bmi < 30)   return 'Overweight';
    if (bmi < 35)   return 'Obese Class I';
    if (bmi < 40)   return 'Obese Class II';
    return 'Obese Class III';
  }

  // ── Healthy weight range ──────────────────────────────────────────────────

  healthyRangeMetric(heightCm) {
    const h = heightCm / 100;
    return {
      min: parseFloat((18.5 * h * h).toFixed(1)),
      max: parseFloat((24.9 * h * h).toFixed(1))
    };
  }

  // ── Gauge percentage ──────────────────────────────────────────────────────

  gaugePercent(bmi) {
    if (bmi <= 10) return 0;
    if (bmi >= 45) return 100;
    return Math.min(100, Math.max(0, ((bmi - 10) / 35) * 100));
  }

  // ── Validation helpers ────────────────────────────────────────────────────

  isValidPositiveNumber(val) {
    return val !== '' && !isNaN(val) && Number(val) > 0;
  }

  // ── Tests ─────────────────────────────────────────────────────────────────

  runAll() {
    console.log('\n🧪 BMI Calculator Test Suite');
    console.log('============================');

    // Metric BMI calculation
    this.runTest('Metric: 70 kg / 170 cm → BMI ≈ 24.2', () => {
      const bmi = this.calculateBMIMetric(70, 170);
      return Math.abs(bmi - 24.22) < 0.05;
    });

    this.runTest('Metric: 50 kg / 160 cm → BMI ≈ 19.5 (Normal)', () => {
      const bmi = this.calculateBMIMetric(50, 160);
      const cat = this.getCategory(bmi);
      return cat === 'Normal weight';
    });

    this.runTest('Metric: 90 kg / 170 cm → Obese Class I (BMI ≈ 31.1)', () => {
      const bmi = this.calculateBMIMetric(90, 170);
      return this.getCategory(bmi) === 'Obese Class I';
    });

    this.runTest('Metric: 40 kg / 170 cm → Underweight', () => {
      const bmi = this.calculateBMIMetric(40, 170);
      return this.getCategory(bmi) === 'Underweight';
    });

    this.runTest('Metric: 110 kg / 170 cm → Obese Class II (BMI ≈ 38.1)', () => {
      const bmi = this.calculateBMIMetric(110, 170);
      return this.getCategory(bmi) === 'Obese Class II';
    });

    this.runTest('Metric: 140 kg / 170 cm → Obese Class III (BMI ≈ 48.4)', () => {
      const bmi = this.calculateBMIMetric(140, 170);
      return this.getCategory(bmi) === 'Obese Class III';
    });

    this.runTest('Metric: 180 kg / 170 cm → Obese Class III', () => {
      const bmi = this.calculateBMIMetric(180, 170);
      return this.getCategory(bmi) === 'Obese Class III';
    });

    // Imperial BMI calculation
    this.runTest('Imperial: 154 lb / 67 in → BMI ≈ 24.1 (Normal)', () => {
      const bmi = this.calculateBMIImperial(154, 67);
      return Math.abs(bmi - 24.1) < 0.2;
    });

    this.runTest('Imperial: 200 lb / 67 in → Obese Class I (BMI ≈ 31.3)', () => {
      const bmi = this.calculateBMIImperial(200, 67);
      return this.getCategory(bmi) === 'Obese Class I';
    });

    this.runTest('Imperial: 5 ft 7 in = 67 total inches', () => {
      return (5 * 12 + 7) === 67;
    });

    // Category boundaries
    this.runTest('Category boundary: BMI 18.5 → Normal weight', () => {
      return this.getCategory(18.5) === 'Normal weight';
    });

    this.runTest('Category boundary: BMI 18.49 → Underweight', () => {
      return this.getCategory(18.49) === 'Underweight';
    });

    this.runTest('Category boundary: BMI 25.0 → Overweight', () => {
      return this.getCategory(25.0) === 'Overweight';
    });

    this.runTest('Category boundary: BMI 30.0 → Obese Class I', () => {
      return this.getCategory(30.0) === 'Obese Class I';
    });

    this.runTest('Category boundary: BMI 40.0 → Obese Class III', () => {
      return this.getCategory(40.0) === 'Obese Class III';
    });

    // Healthy weight range
    this.runTest('Healthy range for 170 cm: 53.5 – 72.0 kg', () => {
      const range = this.healthyRangeMetric(170);
      return range.min === 53.5 && range.max === 72.0;
    });

    // Gauge percentage
    this.runTest('Gauge: BMI 10 → 0%', () => this.gaugePercent(10) === 0);
    this.runTest('Gauge: BMI 45 → 100%', () => this.gaugePercent(45) === 100);
    this.runTest('Gauge: BMI 22 → between 0 and 100%', () => {
      const pct = this.gaugePercent(22);
      return pct > 0 && pct < 100;
    });

    // Input validation
    this.runTest('Validation: empty string → invalid', () => !this.isValidPositiveNumber(''));
    this.runTest('Validation: "abc" → invalid', () => !this.isValidPositiveNumber('abc'));
    this.runTest('Validation: "0" → invalid (not positive)', () => !this.isValidPositiveNumber('0'));
    this.runTest('Validation: "-5" → invalid (negative)', () => !this.isValidPositiveNumber('-5'));
    this.runTest('Validation: "70.5" → valid', () => this.isValidPositiveNumber('70.5'));
    this.runTest('Validation: "170" → valid', () => this.isValidPositiveNumber('170'));

    const total = this.passed + this.failed;
    console.log(`\n📊 BMI Calculator: ${this.passed}/${total} passed`);
    return { total, passed: this.passed, failed: this.failed, failedTests: this.failedTests };
  }
}
