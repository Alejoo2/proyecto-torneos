"use client";

import { useState } from "react";
import { TournamentHero } from "torneos/components/features/tournament/tournament-hero";
import { EnrollmentCta } from "torneos/components/features/tournament/enrollment-cta";
import { BracketView } from "torneos/components/features/tournament/bracket-view";
import { StandingsTable } from "torneos/components/features/tournament/standings-table";
import { TabBar } from "torneos/components/ui/tab-bar";
import { EnrolledTeamCard } from "torneos/components/ui/tournament/enrolled-team-card";

const now = new Date("2026-03-15T19:00:00").getTime();

const TEAMS = {
  storm: { id: "t1", name: "Storm FC", abbreviation: "STM", primaryColor: "#7B2CBF" },
  neutron: { id: "t2", name: "Neutron Utd", abbreviation: "NEU", primaryColor: "#00F5D4" },
  vulkan: { id: "t3", name: "Vulkan FC", abbreviation: "VLK", primaryColor: "#CCFF00" },
  orbit: { id: "t4", name: "Orbit City", abbreviation: "ORB", primaryColor: "#EF4444" },
};

const MATCHES = [
  { id: "m1", status: "FINISHED", scheduledAt: new Date(now - 86_400_000 * 3), homeTeam: TEAMS.storm, awayTeam: TEAMS.neutron, result: { homeScore: 2, awayScore: 1 }, phase: { id: "p1", name: "Liga · Fecha 1", order: 1 } },
  { id: "m2", status: "SCHEDULED", scheduledAt: new Date(now + 86_400_000 * 2), homeTeam: TEAMS.vulkan, awayTeam: TEAMS.orbit, result: null, phase: { id: "p1", name: "Liga · Fecha 1", order: 1 } },
  { id: "m3", status: "POSTPONED", scheduledAt: null, date: null, homeTeam: TEAMS.storm, awayTeam: TEAMS.vulkan, result: null, phase: { id: "p1", name: "Liga · Fecha 2", order: 2 } },
  { id: "m4", status: "SCHEDULED", scheduledAt: new Date(now + 86_400_000 * 9), homeTeam: null, awayTeam: null, result: null, phase: { id: "p2", name: "Semifinales", order: 3 } },
];

const STANDINGS = [
  { position: 1, matchesPlayed: 3, goalDifference: 5, points: 9, team: TEAMS.storm },
  { position: 2, matchesPlayed: 3, goalDifference: 2, points: 6, team: TEAMS.neutron },
  { position: 3, matchesPlayed: 3, goalDifference: -1, points: 3, team: TEAMS.vulkan },
  { position: 4, matchesPlayed: 3, goalDifference: -6, points: 0, team: TEAMS.orbit },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-cypher-4-2-2">{title}</h3>
      {children}
    </section>
  );
}

const noop = () => {
  // noop handler for static demo UI
};

export function Wave2Section() {
  const [tab, setTab] = useState("fixture");
  const [teamId, setTeamId] = useState("t1");

  return (
    <div className="py-6">
      <h2 className="glow-lime mb-6 text-lg font-bold text-cypher-4">Wave 2 — Detalle de Torneo</h2>

      <Section title="TournamentHero (Patrón C: cupos + Age)">
        <TournamentHero
          name="Copa Cypher Apertura"
          status="SCHEDULED"
          format="SINGLE_ELIMINATION"
          courtName="Cancha La 40"
          dayOfWeek={0}
          timeSlot={9}
          enrollmentDeadline={new Date(now + 86_400_000 * 5)}
          enrolledCount={6}
          maxTeams={8}
          activeHolds={1}
          dataUpdatedAt={Date.now() - 20_000}
        />
      </Section>

      <Section title="CTA — Estado A (anónimo)">
        <EnrollmentCta variant="ANON" loginHref="#" />
      </Section>

      <Section title="CTA — Estado B (capitán sin hold)">
        <EnrollmentCta
          variant="READY"
          teams={[TEAMS.storm, TEAMS.neutron, TEAMS.vulkan]}
          selectedTeamId={teamId}
          onSelectTeam={setTeamId}
          onHold={noop}
        />
      </Section>

      <Section title="CTA — Estado C (hold activo, inline)">
        <EnrollmentCta
          variant="HOLDING"
          teams={[TEAMS.storm, TEAMS.neutron]}
          selectedTeamId={teamId}
          onSelectTeam={setTeamId}
          hold={{ expiresAt: now + 4 * 60_000, serverTimestamp: now }}
          onConfirmEnrollment={noop}
        />
      </Section>

      <Section title="CTA — Estado D (inscrito + reevaluar)">
        <EnrollmentCta
          variant="ENROLLED"
          enrollments={[
            { id: "e1", status: "PENDING_AVAILABILITY", team: TEAMS.orbit, availabilityNote: "Solo 3 jugadores disponibles en la franja" },
            { id: "e2", status: "APPROVED", team: TEAMS.storm },
          ]}
          onReevaluate={noop}
        />
      </Section>

      <Section title="EnrolledTeamCard (re-skin)">
        <div className="grid grid-cols-2 gap-3">
          <EnrolledTeamCard teamId="t1" name="Storm FC" abbreviation="STM" primaryColor="#7B2CBF" status="APPROVED" />
          <EnrolledTeamCard teamId="t4" name="Orbit City" abbreviation="ORB" primaryColor="#EF4444" status="PENDING_PAYMENT" availabilityNote="Esperando comprobante" />
        </div>
      </Section>

      <Section title="TabBar + Fixture / Posiciones">
        <TabBar
          tabs={[{ id: "fixture", label: "Fixture" }, { id: "standings", label: "Posiciones" }]}
          active={tab}
          onChange={setTab}
        />
        <div className="pt-4">
          {tab === "fixture" ? <BracketView matches={MATCHES} /> : <StandingsTable rows={STANDINGS} />}
        </div>
      </Section>
    </div>
  );
}