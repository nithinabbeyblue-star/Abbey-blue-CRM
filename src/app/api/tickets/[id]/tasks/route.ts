import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";

const createSchema = z.object({
  content: z.string().min(1).max(500),
});

const updateSchema = z.object({
  id: z.string().min(1),
  completed: z.boolean().optional(),
  content: z.string().min(1).max(500).optional(),
});

// GET /api/tickets/[id]/tasks — List tasks for a ticket
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(
    Role.ADMIN, Role.ADMIN_MANAGER, Role.SALES, Role.SALES_MANAGER, Role.SUPER_ADMIN
  );
  if (error) return error;

  const { id } = await params;

  const tasks = await db.caseTask.findMany({
    where: { ticketId: id },
    orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json({ tasks });
}

// POST /api/tickets/[id]/tasks — Create a task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireRole(
    Role.ADMIN, Role.ADMIN_MANAGER, Role.SALES, Role.SALES_MANAGER, Role.SUPER_ADMIN
  );
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const task = await db.caseTask.create({
      data: {
        content: data.content,
        ticketId: id,
        userId: user.userId,
      },
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    console.error("Create task error:", err);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

// PATCH /api/tickets/[id]/tasks — Toggle or edit a task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(
    Role.ADMIN, Role.ADMIN_MANAGER, Role.SALES, Role.SALES_MANAGER, Role.SUPER_ADMIN
  );
  if (error) return error;

  await params; // consume params

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.completed !== undefined) {
      updateData.completed = data.completed;
      updateData.completedAt = data.completed ? new Date() : null;
    }
    if (data.content !== undefined) {
      updateData.content = data.content;
    }

    const task = await db.caseTask.update({
      where: { id: data.id },
      data: updateData,
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json({ task });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    console.error("Update task error:", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

// DELETE /api/tickets/[id]/tasks — Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(
    Role.ADMIN, Role.ADMIN_MANAGER, Role.SUPER_ADMIN
  );
  if (error) return error;

  await params;

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  await db.caseTask.delete({ where: { id: taskId } });

  return NextResponse.json({ success: true });
}
