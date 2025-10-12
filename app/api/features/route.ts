import { auth } from '@/app/(auth)/auth';
import { getAllFeatures, setFeature, type FeatureKey } from '@/lib/features';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const features = await getAllFeatures();
    return NextResponse.json(features);
  } catch (error) {
    console.error('Error fetching features:', error);
    return NextResponse.json(
      { error: 'Failed to fetch features' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { key, enabled } = await request.json();
    await setFeature(key as FeatureKey, enabled);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting feature:', error);
    return NextResponse.json(
      { error: 'Failed to set feature' },
      { status: 500 },
    );
  }
}
