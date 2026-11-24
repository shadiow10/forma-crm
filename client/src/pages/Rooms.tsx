import { useEffect, useState } from "react";
import { useAppT } from "../appCopy";
import { useData } from "../data";
import type { Room } from "../lib/queries";
import { groupInRoomAt, sameRoom, weeklyRoomHours } from "../lib/rooms";
import { supabase } from "../lib/supabase";
import { FormModal, useShowMore } from "../appUI";
import { Badge, COLORS, DAYS, tint, EmptyState, Icon, MetricCard, PageHeader, Panel } from "../ui";
import { timeRange } from "./Groups";

// The school's rooms (0028): who studies where, and which rooms are in use right now.
// The director adds, renames and removes rooms; the office reads this page.
export function Rooms({ openGroup }: { openGroup: (id: number) => void }) {
  const t = useAppT();
  const r = t.rooms;
  const { rooms, groups, isDirector, save, ask } = useData();
  const [editing, setEditing] = useState<Room | "new" | null>(null);
  // "Right now" moves on by itself: re-read the clock every minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const today = DAYS[now.getDay()];
  const time = now.toTimeString().slice(0, 5);
  const busy = new Map(rooms.map((room) => [room.id, groupInRoomAt(groups, room.name, today, time)]));
  const busyCount = [...busy.values()].filter(Boolean).length;

  const remove = async (room: Room) => await ask({ title: r.deleteTitle(room.name), danger: true, confirmLabel: t.common.del, text: r.deleteText })
    && save(() => supabase.from("rooms").delete().eq("id", room.id), r.deleted);

  const more = useShowMore(rooms);
  return <>
    <PageHeader eyebrow={r.eyebrow} title={r.title} description={r.description} actionLabel={isDirector ? r.action : undefined} onAction={() => setEditing("new")} />
    {rooms.length > 0 && <div className="metrics-grid metrics-grid-4 rooms-metrics">
      <MetricCard label={r.count} value={String(rooms.length)} note={r.countNote} icon="building" accent="#5B8DEF" />
      <MetricCard label={r.busyNow} value={String(busyCount)} note={r.busyNowNote} icon="users" accent={COLORS.yellow} />
      <MetricCard label={r.freeNow} value={String(rooms.length - busyCount)} note={r.freeNowNote} icon="checkCircle" accent={COLORS.green} />
    </div>}
    {rooms.length ? <><div className="class-cards">{more.visible.map((room) => {
      const current = busy.get(room.id);
      const inRoom = groups.filter((group) => group.status !== "Annulé" && sameRoom(group.room, room.name))
        .sort((a, b) => DAYS.indexOf(a.days[0] ?? "") - DAYS.indexOf(b.days[0] ?? "") || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
      return <div className="class-card room-card" key={room.id}>
        <div className="class-color" style={{ background: current ? COLORS.yellow : COLORS.green }} />
        <div className="class-card-main">
          <div className="class-card-top">
            <Badge tone={current ? "warning" : "success"} dot>{current ? r.occupied(current.name) : r.free}</Badge>
            {isDirector && <span className="card-actions">
              <button className="row-menu" aria-label={t.common.edit} onClick={() => setEditing(room)}><Icon name="edit" size={15} /></button>
              <button className="row-menu" aria-label={t.common.del} onClick={() => remove(room)}><Icon name="trash" size={15} /></button>
            </span>}
          </div>
          <h3>{room.name}</h3>
          <p><Icon name="users" size={14} /> {room.capacity ? r.seats(room.capacity) : r.noSeats} · {r.weekly(Math.round(weeklyRoomHours(groups, room.name) * 10) / 10)}</p>
          <div className="room-groups">
            <span>{r.groups}</span>
            {inRoom.length ? inRoom.map((group) => <button key={group.id} className="room-group" aria-label={group.name} onClick={() => openGroup(group.id)}>
              <i style={{ background: tint(group.color) }} /><strong>{group.name}</strong><em>{group.days.map((day) => t.v.day[day]).join(" · ")} {timeRange(group, "")}</em>
            </button>) : <em className="muted-copy">{r.noGroups}</em>}
          </div>
        </div>
      </div>;
    })}</div>{more.button}</> : <Panel><EmptyState title={r.empty} text={r.emptyText} /></Panel>}
    {editing && <RoomForm room={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
  </>;
}

function RoomForm({ room, onClose }: { room?: Room; onClose: () => void }) {
  const t = useAppT();
  const r = t.rooms;
  const { school, rooms, save } = useData();
  return <FormModal title={room ? r.formEdit : r.formNew} subtitle={r.formSubject} submitLabel={room ? t.common.save : r.action} onClose={onClose}
    initial={{ name: room?.name ?? "", capacity: room?.capacity ? String(room.capacity) : "" }}
    fields={[
      { key: "name", label: r.fName, required: true, full: true, placeholder: r.fNamePlaceholder },
      { key: "capacity", label: r.fCapacity, type: "number", min: 1, full: true, placeholder: "30" },
    ]}
    validate={(values) => ({ name: rooms.some((other) => other.id !== room?.id && sameRoom(other.name, values.name)) ? t.errors.duplicate : "" })}
    onSubmit={(values) => {
      const row = { name: values.name.trim(), capacity: values.capacity ? Number(values.capacity) : null };
      return save(() => room ? supabase.from("rooms").update(row).eq("id", room.id) : supabase.from("rooms").insert({ ...row, school_id: school.id }), room ? r.savedEdit : r.savedNew(row.name));
    }} />;
}
