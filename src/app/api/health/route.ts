import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'web-dashboard', timestamp: new Date().toISOString() });
}
