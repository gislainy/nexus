/**
 * Idempotent seed for the reference `blockchain-in-health` DomainConfig.
 * Re-running this script is safe — every insert uses upsert keyed on stable IDs.
 *
 * Curated structural warrants are anchored in Wuest & Gervais (2018),
 * "Do you need a Blockchain?". The veto rules implement the well-known
 * exclusion conditions from the same paper plus standard health-data
 * regulatory guidance.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DOMAIN_ID = "00000000-0000-0000-0000-00000000aaaa";
const DOMAIN_NAME = "blockchain-in-health";
const DOMAIN_VERSION = "1.0.0";

const WUEST_GERVAIS_2018 =
  "Wuest, K., Gervais, A. (2018). Do you need a Blockchain? Crypto Valley Conference on Blockchain Technology (CVCBT). pp. 45-54";

async function main(): Promise<void> {
  await prisma.domainConfig.upsert({
    where: { id: DOMAIN_ID },
    update: {},
    create: {
      id: DOMAIN_ID,
      domainName: DOMAIN_NAME,
      domainVersion: DOMAIN_VERSION,
      description:
        "Reference instantiation of the Nexus framework for evaluating blockchain adoption in digital health projects.",
      tagSet: [
        "technical-justification",
        "regulatory-compliance",
        "blockchain-type",
        "privacy-mechanisms",
        "implementation-capacity",
        "consensus-adequacy",
      ],
      active: true,
      approvedBy: "Gislainy Crisostomo Velasco",
      approvedAt: new Date("2026-05-22T00:00:00.000Z"),
    },
  });

  // ----- DimensionDefinitions -----
  const dimensions = [
    {
      id: "TECHNICAL_JUSTIFICATION",
      name: "Technical Justification",
      description:
        "Whether the project presents a use case whose requirements actually demand a distributed ledger.",
      tag: "technical-justification",
    },
    {
      id: "REGULATORY_COMPLIANCE",
      name: "Regulatory Compliance",
      description:
        "Whether the project satisfies normative requirements applicable to its health context (LGPD, HIPAA, ANVISA).",
      tag: "regulatory-compliance",
    },
    {
      id: "BLOCKCHAIN_TYPE",
      name: "Blockchain Type",
      description:
        "Whether the chosen blockchain type (public, private, permissioned) is coherent with the project requirements.",
      tag: "blockchain-type",
    },
    {
      id: "PRIVACY_MECHANISMS",
      name: "Privacy Mechanisms",
      description:
        "Whether the project employs privacy mechanisms sufficient to protect sensitive health data on the ledger.",
      tag: "privacy-mechanisms",
    },
    {
      id: "IMPLEMENTATION_CAPACITY",
      name: "Implementation Capacity",
      description:
        "Whether the team has the technical capacity required to design, deploy and operate a blockchain solution.",
      tag: "implementation-capacity",
    },
    {
      id: "CONSENSUS_ADEQUACY",
      name: "Consensus Adequacy",
      description:
        "Whether the chosen consensus mechanism is adequate for the throughput, latency and trust assumptions of the project.",
      tag: "consensus-adequacy",
    },
  ];
  for (const d of dimensions) {
    await prisma.dimensionDefinition.upsert({
      where: { id: d.id },
      update: {},
      create: { ...d, domainConfigId: DOMAIN_ID },
    });
  }

  // ----- ProfileDefinitions -----
  const profiles: Array<{
    id: string;
    name: string;
    description: string;
    vocabulary: string[];
    technicalDepth: "LOW" | "MEDIUM" | "HIGH";
  }> = [
    {
      id: "MANAGER",
      name: "Manager / Decision Maker",
      description: "Strategic stakeholder accountable for the adoption decision.",
      vocabulary: ["ROI", "stakeholder", "business case", "compliance"],
      technicalDepth: "LOW",
    },
    {
      id: "ARCHITECT",
      name: "Software Architect / Tech Lead",
      description: "Owns the high-level technical design.",
      vocabulary: ["consensus", "permissioned ledger", "smart contract", "throughput"],
      technicalDepth: "HIGH",
    },
    {
      id: "DEVELOPER",
      name: "Software Developer",
      description: "Implements the system components and integrations.",
      vocabulary: ["API", "SDK", "transaction", "node"],
      technicalDepth: "MEDIUM",
    },
    {
      id: "CLINICAL",
      name: "Clinical Professional",
      description: "Domain user representing the clinical workflow.",
      vocabulary: ["patient record", "clinical workflow", "consent"],
      technicalDepth: "LOW",
    },
    {
      id: "REGULATORY",
      name: "Regulatory / Compliance Specialist",
      description: "Validates the project against normative requirements.",
      vocabulary: ["LGPD", "HIPAA", "ANVISA", "data subject", "audit"],
      technicalDepth: "MEDIUM",
    },
  ];
  for (const p of profiles) {
    await prisma.profileDefinition.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, domainConfigId: DOMAIN_ID },
    });
  }

  // ----- QuestionTemplates needed by ArtifactVariables and vetos -----
  const questions = [
    {
      id: "Q_BLOCKCHAIN_TYPE",
      dimension: "BLOCKCHAIN_TYPE",
      textEn: "Which blockchain type does the project use?",
      textPt: "Qual tipo de blockchain o projeto utiliza?",
      inputType: "SELECT" as const,
      options: ["public", "private", "permissioned", "none"],
      isEntryNode: true,
    },
    {
      id: "Q_PRIVACY_MECHANISM",
      dimension: "PRIVACY_MECHANISMS",
      textEn: "Which privacy mechanism does the project employ on the ledger?",
      textPt: "Qual mecanismo de privacidade o projeto emprega na ledger?",
      inputType: "SELECT" as const,
      options: ["none", "encryption", "zero-knowledge", "off-chain"],
      isEntryNode: true,
    },
    {
      id: "Q_SINGLE_WRITER",
      dimension: "TECHNICAL_JUSTIFICATION",
      textEn: "Does a single trusted party write all data into the system?",
      textPt: "Uma única parte confiável escreve todos os dados no sistema?",
      inputType: "BOOLEAN" as const,
      options: [],
      isEntryNode: true,
    },
    {
      id: "Q_AUDIT_NEED",
      dimension: "TECHNICAL_JUSTIFICATION",
      textEn: "Does the project require immutable third-party audit of its records?",
      textPt: "O projeto requer auditoria imutável de terceiros sobre seus registros?",
      inputType: "BOOLEAN" as const,
      options: [],
      isEntryNode: false,
    },
    {
      id: "Q_REGULATORY_SCOPE",
      dimension: "REGULATORY_COMPLIANCE",
      textEn: "Which regulatory frameworks apply to the project data?",
      textPt: "Quais marcos regulatórios se aplicam aos dados do projeto?",
      inputType: "MULTI_SELECT" as const,
      options: ["LGPD", "HIPAA", "GDPR", "ANVISA", "none"],
      isEntryNode: true,
    },
    {
      id: "Q_TEAM_BLOCKCHAIN_EXPERIENCE",
      dimension: "IMPLEMENTATION_CAPACITY",
      textEn: "Does the team have prior blockchain implementation experience?",
      textPt: "A equipe possui experiência prévia em implementação de blockchain?",
      inputType: "BOOLEAN" as const,
      options: [],
      isEntryNode: true,
    },
    {
      id: "Q_CONSENSUS_MECHANISM",
      dimension: "CONSENSUS_ADEQUACY",
      textEn: "Which consensus mechanism does the chosen network rely on?",
      textPt: "Qual mecanismo de consenso a rede escolhida utiliza?",
      inputType: "SELECT" as const,
      options: ["PoW", "PoS", "PBFT", "Raft", "other"],
      isEntryNode: true,
    },
  ];

  const baseTextByProfile = (textEn: string, textPt: string) => {
    const map: Record<string, Record<string, string>> = {};
    for (const profileId of ["MANAGER", "ARCHITECT", "DEVELOPER", "CLINICAL", "REGULATORY"]) {
      map[profileId] = { en: textEn, pt: textPt };
    }
    return map;
  };

  for (const q of questions) {
    await prisma.questionTemplate.upsert({
      where: { id: q.id },
      update: {},
      create: {
        id: q.id,
        domainConfigId: DOMAIN_ID,
        dimension: q.dimension,
        targetProfiles: [
          "MANAGER",
          "ARCHITECT",
          "DEVELOPER",
          "CLINICAL",
          "REGULATORY",
        ],
        textEn: q.textEn,
        textPt: q.textPt,
        textByProfile: baseTextByProfile(q.textEn, q.textPt),
        inputType: q.inputType,
        options: q.options,
        isCriticalForArgument: true,
        isEntryNode: q.isEntryNode,
      },
    });
  }

  // ----- WarrantDefinitions (one per dimension) -----
  const warrants = [
    {
      id: "W_TECHNICAL_JUSTIFICATION",
      dimensionId: "TECHNICAL_JUSTIFICATION",
      structuralWarrant:
        "A blockchain is justified when multiple mutually distrusting writers must share state and a trusted third party is unavailable or undesirable.",
    },
    {
      id: "W_REGULATORY_COMPLIANCE",
      dimensionId: "REGULATORY_COMPLIANCE",
      structuralWarrant:
        "Health data on a ledger is acceptable only when the architecture honors data subject rights (rectification, erasure) mandated by applicable frameworks.",
    },
    {
      id: "W_BLOCKCHAIN_TYPE",
      dimensionId: "BLOCKCHAIN_TYPE",
      structuralWarrant:
        "The blockchain type must match the trust assumptions: permissioned ledgers fit known participants, public ledgers fit open verification.",
    },
    {
      id: "W_PRIVACY_MECHANISMS",
      dimensionId: "PRIVACY_MECHANISMS",
      structuralWarrant:
        "Sensitive health data on a public ledger requires cryptographic privacy mechanisms or off-chain storage with on-chain hashes.",
    },
    {
      id: "W_IMPLEMENTATION_CAPACITY",
      dimensionId: "IMPLEMENTATION_CAPACITY",
      structuralWarrant:
        "A team lacking experience in distributed systems and cryptographic primitives is unlikely to deliver a safe blockchain deployment.",
    },
    {
      id: "W_CONSENSUS_ADEQUACY",
      dimensionId: "CONSENSUS_ADEQUACY",
      structuralWarrant:
        "The consensus mechanism must satisfy the throughput, latency and fault-tolerance requirements of the target health workflow.",
    },
  ];
  for (const w of warrants) {
    await prisma.warrantDefinition.upsert({
      where: { id: w.id },
      update: {},
      create: {
        id: w.id,
        domainConfigId: DOMAIN_ID,
        dimensionId: w.dimensionId,
        structuralWarrant: w.structuralWarrant,
        sources: [WUEST_GERVAIS_2018],
      },
    });
  }

  // ----- VetoDefinitions -----
  const vetos = [
    {
      id: "VETO_SINGLE_WRITER",
      condition:
        "The project has a single trusted writer of data and therefore does not need a distributed ledger.",
      description:
        "A single writer scenario is solved by a conventional database. Adopting blockchain adds overhead without any trust benefit.",
      evaluationRule: {
        field: "answer.Q_SINGLE_WRITER.value",
        operator: "equals",
        value: "true",
      },
      remediationPath: [
        "Reassess whether multiple independent writers really exist.",
        "If only one writer is required, replace blockchain with an auditable relational database.",
      ],
    },
    {
      id: "VETO_NO_PRIVACY_PUBLIC",
      condition:
        "The project plans to store sensitive health data on a public blockchain without any privacy mechanism.",
      description:
        "Storing clear-text sensitive data on a public ledger violates LGPD, HIPAA and GDPR principles. The breach is irreversible because of ledger immutability.",
      evaluationRule: {
        operator: "AND",
        conditions: [
          {
            field: "answer.Q_BLOCKCHAIN_TYPE.value",
            operator: "equals",
            value: "public",
          },
          {
            field: "answer.Q_PRIVACY_MECHANISM.value",
            operator: "equals",
            value: "none",
          },
        ],
      },
      remediationPath: [
        "Move sensitive data off-chain and keep only cryptographic anchors on-chain.",
        "Adopt encryption or zero-knowledge proofs before any public deployment.",
      ],
    },
    {
      id: "VETO_NO_AUDIT_NEED",
      condition:
        "There is no requirement for immutable third-party audit of the project records.",
      description:
        "Without an explicit audit requirement, the immutability premise of blockchain provides no actionable value.",
      evaluationRule: {
        field: "answer.Q_AUDIT_NEED.value",
        operator: "equals",
        value: "false",
      },
      remediationPath: [
        "Document the audit or non-repudiation requirements that justify ledger immutability.",
        "If immutability is not required, choose a system with mutable storage and proper backups.",
      ],
    },
  ];
  for (const v of vetos) {
    await prisma.vetoDefinition.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        domainConfigId: DOMAIN_ID,
        condition: v.condition,
        description: v.description,
        evaluationRule: v.evaluationRule,
        remediationPath: v.remediationPath,
        sources: [WUEST_GERVAIS_2018],
      },
    });
  }

  // ----- ArtifactVariables -----
  const variables = [
    {
      id: "VAR_BLOCKCHAIN_TYPE",
      name: "Blockchain Type",
      description: "The blockchain type declared by the project artifacts.",
      extractionHint:
        "Look for configuration files, README sections or architecture diagrams that mention public, private or permissioned ledgers.",
      mapsToQuestionId: "Q_BLOCKCHAIN_TYPE",
    },
    {
      id: "VAR_PRIVACY_MECHANISM",
      name: "Privacy Mechanism",
      description: "The privacy mechanism applied to ledger-resident data.",
      extractionHint:
        "Search for encryption libraries, zero-knowledge proofs, or off-chain storage references in code and docs.",
      mapsToQuestionId: "Q_PRIVACY_MECHANISM",
    },
    {
      id: "VAR_SINGLE_WRITER",
      name: "Single Writer Topology",
      description: "Whether a single party is the sole writer of records.",
      extractionHint:
        "Inspect access-control policies and write permissions; if a single role owns all writes, mark as true.",
      mapsToQuestionId: "Q_SINGLE_WRITER",
    },
  ];
  for (const v of variables) {
    await prisma.artifactVariable.upsert({
      where: { id: v.id },
      update: {},
      create: { ...v, domainConfigId: DOMAIN_ID },
    });
  }

  console.log(
    `Seed complete: DomainConfig=${DOMAIN_NAME}@${DOMAIN_VERSION} (${DOMAIN_ID})`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
