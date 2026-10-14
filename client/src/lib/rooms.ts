import type { Group } from "./queries";

// Room schedule rules, shared by the rooms page and the group form. A room is busy when an open
// group with that room meets on one of the same days and the hours cross. groups.room holds the
// room's name (migration 0028).

const hhmm = (time: string | null) => (time ? time.slice(0, 5) : "");

export const sameRoom = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase() && (a ?? "").trim() !== "";

// The open groups that use this room and would clash with these days and hours.
export function roomClashes(groups: Group[], room: string, days: string[], start: string, end: string, exceptGroupId?: number) {
  return groups.filter((group) => group.id !== exceptGroupId && group.status !== "Annulé" && sameRoom(group.room, room)
    && group.start_time && group.end_time && group.days.some((day) => days.includes(day))
    && hhmm(group.start_time) < end && start < hhmm(group.end_time));
}

// The group in this room right now (day name as stored: "Dim"… and "HH:MM"), if any.
export const groupInRoomAt = (groups: Group[], room: string, day: string, time: string) =>
  groups.find((group) => group.status !== "Annulé" && sameRoom(group.room, room) && group.days.includes(day)
    && hhmm(group.start_time) <= time && time < hhmm(group.end_time));

// Hours of classes per week in this room.
export const weeklyRoomHours = (groups: Group[], room: string) => groups
  .filter((group) => group.status !== "Annulé" && sameRoom(group.room, room) && group.start_time && group.end_time)
  .reduce((sum, group) => {
    const [sh, sm] = group.start_time!.split(":").map(Number);
    const [eh, em] = group.end_time!.split(":").map(Number);
    return sum + group.days.length * ((eh * 60 + em - sh * 60 - sm) / 60);
  }, 0);
