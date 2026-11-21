"use client";

import { useParams } from "next/navigation";
import { MatchDetail } from "@/components/mentorship/MatchDetail";

export default function RelationshipPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  return <MatchDetail id={id} />;
}
