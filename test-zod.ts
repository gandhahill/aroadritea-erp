import { z } from 'zod';

const SignupInputSchema = z.object({
  email: z.string().email().max(254),
  phone: z
    .string()
    .min(10)
    .max(20)
    .regex(/^\+?[0-9]+$/, 'Invalid phone number'),
  name: z.string().min(2).max(100),
  birthDate: z.string().min(10, 'Birth date is required'), // YYYY-MM-DD
  city: z.string().min(1, 'City is required'),
  password: z.string().min(8).max(128),
  consentGiven: z.boolean().refine((v) => v === true, 'Consent is required'),
  turnstileToken: z.string().min(1), // Cloudflare Turnstile token
});

const testData = {
  email: 'test@example.com',
  phone: '08123456789',
  name: 'Test Name',
  birthDate: '1990-01-01',
  city: 'Jakarta',
  password: 'password123',
  consentGiven: true,
  turnstileToken: 'dummy'
};

const result = SignupInputSchema.safeParse(testData);
if (!result.success) {
  console.log(result.error.issues);
} else {
  console.log('Success');
}
