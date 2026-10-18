import type { Role } from "@prisma/client";
import { ROLE_RANK } from "@/lib/auth/constants";

/**
 * Who may manage whom (Налаштування → Користувачі):
 *   - nobody changes their own role or flags;
 *   - only SUPER_ADMIN manages ADMIN / SUPER_ADMIN accounts and grants
 *     those roles;
 *   - otherwise an actor may only touch users ranked strictly below them
 *     and assign roles strictly below their own;
 *   - the last SUPER_ADMIN can never be demoted.
 * Returns the reason for a refusal, or null when allowed.
 */
export function userChangeRefusal(input: {
  actor: { id: string; role: Role };
  target: { id: string; role: Role };
  newRole?: Role;
  superAdminCount: number;
}): string | null {
  const { actor, target, newRole } = input;
  if (actor.id === target.id) return "Не можна змінювати власну роль чи права";
  const actorIsSuper = actor.role === "SUPER_ADMIN";
  if (!actorIsSuper) {
    if (ROLE_RANK[target.role] >= ROLE_RANK[actor.role]) {
      return "Можна змінювати лише користувачів з нижчою роллю";
    }
    if (newRole && ROLE_RANK[newRole] >= ROLE_RANK[actor.role]) {
      return "Можна призначати лише ролі нижчі за власну";
    }
  }
  if (newRole && target.role === "SUPER_ADMIN" && newRole !== "SUPER_ADMIN" && input.superAdminCount <= 1) {
    return "Не можна понизити останнього супер-адміністратора";
  }
  return null;
}
