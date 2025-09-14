import React, { useMemo } from "react";
import Header from "./components/Header";
import "./App.css";
import "./dashboard.css";

import {
  PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

import {
  useDocumentsCount,
  usePropositionsKpis,
  usePropositionsBreakdowns,
  useTemplatesCount,
  useTemplatesUsage,
} from "./hooks/DashboardHooks";

import projetIcon from "../icons/PROJET.png";
import templateIcon from "../icons/TEMPLATE.png";
import budgetIcon from "../icons/BUDJET.png";
import baseIcon from "../icons/BASE.png";

/* Helpers */
const formatCurrency = (n) =>
  (Number(n) || 0).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const COLORS_DB = ["#00B4D8", "#885AFE", "#22C55E"];
const COLORS_TAILLE = ["#22C55E", "#885AFE", "#00B4D8"];
const BAR_SIZE = 38;

/* UI */
function KpiCard({ label, value, icon, iconBgClass }) {
  return (
    <div className="card card--kpi">
      <div className={`kpi__icon ${iconBgClass || ""}`}>
        <img src={icon} alt={label} className="kpi-img-icon" />
      </div>
      <div>
        <div className="kpi__value">{value}</div>
        <div className="kpi__label">{label}</div>
      </div>
    </div>
  );
}

function ChartCard({ titleText, titleIcon, children }) {
  return (
    <div className="card">
      <div className="chart-card__header">
        {titleIcon && <img src={titleIcon} alt="" className="chart-card__title-icon" />}
        <h3 className="chart-card__title">{titleText}</h3>
      </div>
      <div className="chart-card__inner">{children}</div>
    </div>
  );
}

function EmptyState() {
  return <div className="empty-state">Chargement des données...</div>;
}

/* Page */
export default function Dashboard() {
  const filters = {};

  const { count: docCount, loading: lDocs } = useDocumentsCount(filters);
  const { count: tplCount, loading: lTpl } = useTemplatesCount(filters);
  const { propositionsGenerees, loading: lGen } = useTemplatesUsage(filters);
  const {
    count: propTotal,
    countEnCours: activeProjects,
    sumBudgetValide,
    loading: lKpis,
  } = usePropositionsKpis(filters);
  const { byTaille, loading: lBreak } = usePropositionsBreakdowns(filters);

  const isLoading = lDocs || lTpl || lGen || lKpis || lBreak;

  const dbOverviewData = useMemo(
    () => [
      { name: "Appel d'offre", value: docCount ?? 0 },
      { name: "Propositions", value: propTotal ?? 0 },
      { name: "Templates", value: tplCount ?? 0 },
    ],
    [docCount, propTotal, tplCount]
  );

  const pieDataTaille = useMemo(() => {
    if (!byTaille) return [];
    return Object.entries(byTaille).map(([name, value]) => ({
      name,
      value: Number(value) || 0,
    }));
  }, [byTaille]);

  const totalTaille = useMemo(
    () => pieDataTaille.reduce((sum, item) => sum + (item?.value || 0), 0),
    [pieDataTaille]
  );

  if (isLoading) {
    return (
      <div className="dashboard dashboard--compact">
        <Header title="Tableau de Bord" subtitle="" />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="dashboard dashboard--compact">
      <Header title="Tableau de Bord" subtitle="" />

      <main className="dashboard__main">
        {/* ===== Rangée 1 : 3 KPI alignées horizontalement ===== */}
        <section className="kpis-row">
          <KpiCard
            label="Projets Actifs"
            value={activeProjects ?? 0}
            icon={projetIcon}
            iconBgClass="bg-red-soft"
          />
          <KpiCard
            label="Propositions Générées"
            value={propositionsGenerees ?? 0}
            icon={templateIcon}
            iconBgClass="bg-purple-soft"
          />
          <KpiCard
            label="Budget Validé"
            value={formatCurrency(sumBudgetValide)}
            icon={budgetIcon}
            iconBgClass="bg-green-soft"
          />
        </section>

        {/* ===== Rangée 2 : 2 charts alignés horizontalement ===== */}
        <section className="charts-row">
          <ChartCard titleText="Aperçu de la Base de Données" titleIcon={baseIcon}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dbOverviewData}
                margin={{ top: 0, right: 8, left: -10, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickMargin={6} />
                <YAxis />
                <Tooltip cursor={{ fill: "rgba(243, 244, 246, 0.5)" }} />
                <Bar dataKey="value" barSize={BAR_SIZE} radius={[8, 8, 0, 0]}>
                  {dbOverviewData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS_DB[index % COLORS_DB.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard titleText="Répartition des propositions par taille">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieDataTaille}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={90}
                  paddingAngle={3}
                  cornerRadius={8}
                  isAnimationActive
                >
                  {pieDataTaille.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS_TAILLE[index % COLORS_TAILLE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const v = Number(value) || 0;
                    const pct = totalTaille > 0 ? Math.round((v / totalTaille) * 100) : 0;
                    return [v, `${name} (${pct}%)`];
                  }}
                />
                <Legend verticalAlign="bottom" height={24} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>
      </main>
    </div>
  );
}
