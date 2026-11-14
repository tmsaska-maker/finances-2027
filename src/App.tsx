import { useMemo, useState } from "react"
import ServerExpenses from "./ServerExpenses"
import { readDemoSession, saveDemoSession, toKopiykas, toMinor, type DemoExpense, type DemoPending } from "./domain/expense-session"

type Space = "business" | "personal"
type Project = "Усі напрями" | "Амбулаторія" | "Скринінг" | "Психотерапія"
type Screen = "dashboard" | "banks" | "income" | "expenses" | "planning" | "payroll" | "taxes" | "forecast" | "analytics" | "settings"

type IconName = "grid" | "wallet" | "trend" | "receipt" | "calendar" | "users" | "file" | "chart" | "shield" | "settings" | "plus" | "bell" | "search" | "chevron" | "arrow" | "check" | "alert" | "more" | "building" | "user" | "close" | "upload" | "split"

const paths: Record<IconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7V5a2 2 0 0 1 2-2h12" />
      <rect x="3" y="7" width="18" height="14" rx="3" />
      <path d="M16 13h5v4h-5a2 2 0 0 1 0-4Z" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-9" />
      <path d="M15 6h6v6" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v19l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  file: (
    <>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3v-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  alert: (
    <>
      <path d="M12 3 2.5 20h19Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  building: (
    <>
      <path d="M3 21h18M6 21V7l6-4 6 4v14M9 10h1M14 10h1M9 14h1M14 14h1M10 21v-3h4v3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 15v5h16v-5" />
    </>
  ),
  split: (
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v4M16 21h3a2 2 0 0 0 2-2v-4M3 9c0 6 18 6 18 12M21 15C21 9 3 9 3 3" />
    </>
  ),
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

const businessNav: { id: Screen; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Головна", icon: "grid" },
  { id: "banks", label: "Гроші та банки", icon: "wallet" },
  { id: "income", label: "Доходи й ефективність", icon: "trend" },
  { id: "expenses", label: "Витрати та зобов’язання", icon: "receipt" },
  { id: "planning", label: "Планування", icon: "calendar" },
  { id: "payroll", label: "Зарплата", icon: "users" },
  { id: "taxes", label: "Податки та звітність", icon: "file" },
  { id: "forecast", label: "Бюджет і прогноз", icon: "chart" },
  { id: "analytics", label: "Аналітика й контроль", icon: "shield" },
]

const personalNav: { id: Screen; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Особиста головна", icon: "grid" },
  { id: "banks", label: "Рахунки та операції", icon: "wallet" },
  { id: "income", label: "Доходи", icon: "trend" },
  { id: "expenses", label: "Витрати", icon: "receipt" },
  { id: "planning", label: "Бюджет і планування", icon: "calendar" },
  { id: "payroll", label: "Зобов’язання", icon: "file" },
  { id: "forecast", label: "Заощадження та цілі", icon: "chart" },
  { id: "analytics", label: "Аналітика", icon: "shield" },
]

const formatMoney = (value: number) =>
  new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(value) +
  " ₴"

function App() {
  const [space, setSpace] = useState<Space>("business")
  const [screen, setScreen] = useState<Screen>("dashboard")
  const [direction, setDirection] = useState<Project>("Усі напрями")
  const [panel, setPanel] = useState<"day" | "transfer" | "pos" | null>(null)
  const [toast, setToast] = useState("")
  const [mobileNav, setMobileNav] = useState(false)

  const switchSpace = (next: Space) => {
    setSpace(next)
    setScreen("dashboard")
    setMobileNav(false)
  }

  const navigate = (next: Screen) => {
    setScreen(next)
    setMobileNav(false)
  }

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 2600)
  }

  const title = (space === "business" ? businessNav : personalNav).find(
    (item) => item.id === screen,
  )?.label

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div>
            <strong>Фінанси</strong>
            <small>2027</small>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileNav(false)}
            aria-label="Закрити меню"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="space-switch">
          <button
            className={space === "business" ? "active" : ""}
            onClick={() => switchSpace("business")}
          >
            <Icon name="building" size={16} /> Бізнес
          </button>
          <button
            className={space === "personal" ? "active" : ""}
            onClick={() => switchSpace("personal")}
          >
            <Icon name="user" size={16} /> Особисті
          </button>
        </div>

        <nav className="nav-list" aria-label="Головна навігація">
          {(space === "business" ? businessNav : personalNav).map((item) => (
            <button
              key={item.id}
              className={screen === item.id ? "active" : ""}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "expenses" && space === "business" && <em>3</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {space === "business" && (
            <button
              className="owner-transfer"
              onClick={() => setPanel("transfer")}
            >
              <Icon name="arrow" size={16} /> Переказ власниці
            </button>
          )}
          <button
            className={screen === "settings" ? "active" : ""}
            onClick={() => navigate("settings")}
          >
            <Icon name="settings" /> Налаштування
          </button>
          <div className="profile">
            <div className="avatar">С</div>
            <div>
              <strong>Саска</strong>
              <small>Власниця · адміністраторка</small>
            </div>
            <Icon name="more" />
          </div>
        </div>
      </aside>

      {mobileNav && (
        <button
          className="nav-scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Закрити меню"
        />
      )}

      <main className={`main ${space === "personal" ? "personal-main" : ""}`}>
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileNav(true)}
            aria-label="Відкрити меню"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="breadcrumbs">
            <span>{space === "business" ? "Бізнес" : "Особисті фінанси"}</span>
            <Icon name="chevron" size={14} />
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <button className="search">
              <Icon name="search" />
              <span>Пошук</span>
              <kbd>⌘ K</kbd>
            </button>
            <button className="icon-button has-dot" aria-label="Сповіщення">
              <Icon name="bell" />
            </button>
            {space === "business" && (
              <button
                className="primary compact"
                onClick={() => navigate("planning")}
              >
                <Icon name="plus" size={16} /> Створити план
              </button>
            )}
          </div>
        </header>

        <div
          className={
            space === "business"
              ? `content project-theme project-${direction === "Усі напрями" ? "all" : direction === "Амбулаторія" ? "clinic" : direction === "Скринінг" ? "screening" : "therapy"}`
              : "content personal-content"
          }
        >
          {space === "business" && (
            <>
              {screen === "dashboard" && (
                <BusinessDashboard
                  direction={direction}
                  setDirection={setDirection}
                  setPanel={setPanel}
                  navigate={navigate}
                />
              )}
              {screen === "expenses" && (new URLSearchParams(window.location.search).get("financeServer")==="1"
                ? <ServerExpenses />
                : <ExpensesScreen project={direction} setProject={setDirection} navigate={navigate} notify={notify} />
              )}
              {screen === "planning" && (
                <Planning
                  notify={notify}
                  project={direction}
                  setProject={setDirection}
                />
              )}
              {screen === "payroll" && <Payroll notify={notify} />}
              {screen === "taxes" && <Taxes notify={notify} />}
              {screen === "banks" && (
                <Banks setPanel={setPanel} notify={notify} />
              )}
              {screen === "income" && (
                <IncomeScreen
                  project={direction}
                  setProject={setDirection}
                />
              )}
              {screen === "forecast" && (
                <ForecastScreen
                  project={direction}
                  setProject={setDirection}
                />
              )}
              {screen === "analytics" && (
                <AnalyticsScreen
                  project={direction}
                  setProject={setDirection}
                />
              )}
              {![
                "dashboard",
                "expenses",
                "planning",
                "payroll",
                "taxes",
                "banks",
                "income",
                "forecast",
                "analytics",
              ].includes(screen) && <GenericScreen screen={screen} />}
            </>
          )}
          {space === "personal" && (
            <>
              {screen === "dashboard" && (
                <PersonalDashboard navigate={navigate} />
              )}
              {screen === "planning" && <PersonalPlanning notify={notify} />}
              {screen !== "dashboard" && screen !== "planning" && (
                <PersonalGeneric screen={screen} />
              )}
            </>
          )}
        </div>
      </main>

      {panel === "day" && <DayPanel close={() => setPanel(null)} />}
      {panel === "transfer" && (
        <TransferPanel
          close={() => setPanel(null)}
          done={() => {
            setPanel(null)
            notify("Переказ збережено без подвійного обліку")
          }}
        />
      )}
      {panel === "pos" && (
        <PosPanel
          close={() => setPanel(null)}
          done={() => {
            setPanel(null)
            notify("POS-надходження розподілено")
          }}
        />
      )}
      {toast && (
        <div className="toast">
          <span>
            <Icon name="check" size={16} />
          </span>
          {toast}
        </div>
      )}

      <nav className="mobile-tabs">
        <button
          className={screen === "dashboard" ? "active" : ""}
          onClick={() => navigate("dashboard")}
        >
          <Icon name="grid" />
          <span>Головна</span>
        </button>
        <button
          className={screen === "banks" ? "active" : ""}
          onClick={() => navigate("banks")}
        >
          <Icon name="wallet" />
          <span>Рахунки</span>
        </button>
        <button
          className={screen === "planning" ? "active" : ""}
          onClick={() => navigate("planning")}
        >
          <Icon name="calendar" />
          <span>План</span>
        </button>
        <button onClick={() => setMobileNav(true)}>
          <Icon name="more" />
          <span>Ще</span>
        </button>
      </nav>
    </div>
  )
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  )
}

function FamilyHeartMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      role="img"
      aria-label="Сімейний лікар на Мазепи"
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M34 36.7C23.1 36.7 16.8 44.8 19.3 55.2C22.4 67.1 36.2 73.8 48 81"
          stroke="#173E70"
          strokeWidth="9.8"
        />
        <path
          d="M62 36.7C72.9 36.7 79.2 44.8 76.7 55.2C73.6 67.1 59.8 73.8 48 81"
          stroke="#258F94"
          strokeWidth="9.8"
        />
        <path
          d="M37.2 62.8C40.1 58.7 43.9 57 48 57C52.1 57 55.9 58.7 58.8 62.8"
          stroke="#438F7E"
          strokeWidth="7.8"
        />
      </g>
      <circle cx="34" cy="23.5" r="7.3" fill="#173E70" />
      <circle cx="62" cy="23.5" r="7.3" fill="#258F94" />
      <circle cx="48" cy="48.2" r="6.7" fill="#438F7E" />
    </svg>
  )
}

function ProjectSwitcher({
  project,
  setProject,
}: {
  project: Project
  setProject: (project: Project) => void
}) {
  const projects: Project[] = [
    "Усі напрями",
    "Амбулаторія",
    "Скринінг",
    "Психотерапія",
  ]
  return (
    <div className="project-switcher" aria-label="Вибір бізнес-напряму">
      {projects.map((item) => (
        <button
          key={item}
          className={project === item ? "active" : ""}
          onClick={() => setProject(item)}
        >
          <span className={`project-symbol symbol-${item}`}>
            {item === "Усі напрями" && <Icon name="grid" size={15} />}
            {item === "Амбулаторія" && <FamilyHeartMark />}
            {item === "Скринінг" && <b>40+</b>}
            {item === "Психотерапія" && <Icon name="users" size={15} />}
          </span>
          <span>
            <strong>{item}</strong>
            <small>
              {item === "Усі напрями"
                ? "Консолідовано"
                : item === "Амбулаторія"
                  ? "Сімейний лікар на Мазепи"
                  : item === "Скринінг"
                    ? "Програма профілактики"
                    : "Практика психотерапії"}
            </small>
          </span>
          {project === item && <Icon name="check" size={14} />}
        </button>
      ))}
    </div>
  )
}

function ProjectIdentity({ project }: { project: Project }) {
  if (project === "Усі напрями") return null
  return (
    <div className="project-identity">
      <span className="identity-mark">
        {project === "Амбулаторія" && <FamilyHeartMark />}
        {project === "Скринінг" && <b>40+</b>}
        {project === "Психотерапія" && <Icon name="users" size={18} />}
      </span>
      <span>
        <small>
          {project === "Амбулаторія"
            ? "СІМЕЙНИЙ ЛІКАР НА МАЗЕПИ"
            : project === "Скринінг"
              ? "ПРОФІЛАКТИКА · СКРИНІНГ 40+"
              : "ПРАКТИКА ПСИХОТЕРАПІЇ"}
        </small>
        <strong>{project}</strong>
      </span>
      <i />
    </div>
  )
}

function BusinessDashboard({
  direction,
  setDirection,
  setPanel,
  navigate,
}: {
  direction: Project
  setDirection: (v: Project) => void
  setPanel: (v: "day") => void
  navigate: (v: Screen) => void
}) {
  const balances =
    direction === "Скринінг"
      ? [482300, 196400, 811900]
      : [1246800, 421600, 1823400]
  return (
    <>
      <PageHeading
        eyebrow="Середа, 12 травня"
        title="Фінансова картина"
        subtitle="Оперативний стан і прогноз до кінця травня"
        actions={
          <>
            <div className="segmented">
              {(
                [
                  "Усі напрями",
                  "Амбулаторія",
                  "Скринінг",
                  "Психотерапія",
                ] as Project[]
              ).map((x) => (
                  <button
                    key={x}
                    className={direction === x ? "active" : ""}
                    onClick={() => setDirection(x)}
                  >
                    {x}
                  </button>
                ))}
            </div>
            <button className="more-button">
              <Icon name="more" />
            </button>
          </>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Кошти на рахунках"
          value={formatMoney(balances[0])}
          note="4 рахунки · оновлено 10:42"
          trend="+8,4% до 1 травня"
        />
        <Metric
          label="Заплановано до сплати"
          value={formatMoney(balances[1])}
          note="до 31 травня"
          warning="48 200 ₴ прострочено"
        />
        <Metric
          label="Прогноз на кінець місяця"
          value={formatMoney(balances[2])}
          note="з урахуванням планів"
          trend="+126 000 ₴ до плану"
        />
        <Metric
          label="Управлінський результат"
          value="+634 200 ₴"
          note="зароблено, не рух грошей"
          trend="Маржа 28,6%"
        />
      </div>
      <div className="dashboard-grid">
        <section className="card cash-card">
          <div className="card-head">
            <div>
              <h2>Майбутній залишок коштів</h2>
              <p>Щоденний прогноз · усі рахунки</p>
            </div>
            <div className="legend">
              <span>
                <i className="teal" />
                Прогноз
              </span>
              <span>
                <i className="dashed" />
                Мін. резерв
              </span>
            </div>
          </div>
          <CashChart onDay={() => setPanel("day")} />
          <div className="chart-caption">
            <Icon name="alert" size={16} />
            <span>
              <strong>20 травня — найнижчий залишок</strong> 742 000 ₴ після
              виплати податків
            </span>
            <button onClick={() => setPanel("day")}>
              Переглянути події <Icon name="arrow" size={14} />
            </button>
          </div>
        </section>
        <section className="card attention-card">
          <div className="card-head">
            <div>
              <h2>Потребує уваги</h2>
              <p>5 завдань на сьогодні</p>
            </div>
            <button
              className="link-button"
              onClick={() => navigate("expenses")}
            >
              Усі завдання
            </button>
          </div>
          <Attention
            icon="alert"
            tone="red"
            title="Платіж прострочено"
            text="Оренда кабінету · 32 000 ₴"
            meta="2 дні"
          />
          <Attention
            icon="split"
            tone="amber"
            title="Не розподілено надходження"
            text="POS-пакет за 11 травня · 46 800 ₴"
            meta="Звірити"
          />
          <Attention
            icon="file"
            tone="blue"
            title="Очікує квитанція №2"
            text="Зарплатний звіт · I квартал"
            meta="6 год"
          />
          <Attention
            icon="check"
            tone="green"
            title="Виписку синхронізовано"
            text="monobank · 28 нових операцій"
            meta="10:42"
          />
        </section>
      </div>
      <div className="lower-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Ефективність напрямів</h2>
              <p>Травень · факт і прогноз</p>
            </div>
            <button className="link-button" onClick={() => navigate("income")}>
              Детальніше
            </button>
          </div>
          <div className="efficiency-head">
            <span>Напрям</span>
            <span>Дохід</span>
            <span>Маржа</span>
            <span>Динаміка</span>
          </div>
          <Efficiency
            name="Амбулаторія"
            color="#137f74"
            value="1 342 000 ₴"
            margin="31,2%"
            width="78%"
          />
          <Efficiency
            name="Скринінг"
            color="#577a9b"
            value="612 400 ₴"
            margin="24,8%"
            width="56%"
          />
          <Efficiency
            name="Психотерапія"
            color="#8673a4"
            value="263 800 ₴"
            margin="42,1%"
            width="38%"
          />
        </section>
        <section className="card commitments">
          <div className="card-head">
            <div>
              <h2>Найближчі платежі</h2>
              <p>Наступні 7 днів</p>
            </div>
            <button
              className="link-button"
              onClick={() => navigate("expenses")}
            >
              Календар
            </button>
          </div>
          <Payment
            date="15"
            month="тра"
            title="Аванс · Амбулаторія"
            account="monobank ФОП"
            amount="168 400 ₴"
            status="Готово"
          />
          <Payment
            date="17"
            month="тра"
            title="ЄСВ та ПДФО"
            account="ПриватБанк ФОП"
            amount="86 200 ₴"
            status="На перевірці"
          />
          <Payment
            date="20"
            month="тра"
            title="Оренда й комунальні"
            account="monobank ФОП"
            amount="74 600 ₴"
            status="Заплановано"
          />
        </section>
      </div>
    </>
  )
}

function Metric({
  label,
  value,
  note,
  trend,
  warning,
}: {
  label: string
  value: string
  note: string
  trend?: string
  warning?: string
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">
        {label}
        <button>
          <Icon name="more" size={16} />
        </button>
      </div>
      <strong>{value}</strong>
      <div className="metric-foot">
        <span>{note}</span>
        {trend && <em>{trend}</em>}
        {warning && <em className="warning-text">{warning}</em>}
      </div>
    </div>
  )
}

function CashChart({ onDay }: { onDay: () => void }) {
  const days = ["12", "14", "16", "18", "20", "22", "24", "26", "28", "30"]
  return (
    <div className="chart-wrap">
      <div className="y-labels">
        <span>2,0м</span>
        <span>1,5м</span>
        <span>1,0м</span>
        <span>500к</span>
      </div>
      <svg
        className="cash-svg"
        viewBox="0 0 760 210"
        preserveAspectRatio="none"
        aria-label="Графік прогнозу залишку"
      >
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#238f82" stopOpacity=".18" />
            <stop offset="1" stopColor="#238f82" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="grid-lines">
          <line x1="0" y1="20" x2="760" y2="20" />
          <line x1="0" y1="75" x2="760" y2="75" />
          <line x1="0" y1="130" x2="760" y2="130" />
          <line x1="0" y1="185" x2="760" y2="185" />
        </g>
        <line className="reserve" x1="0" y1="162" x2="760" y2="162" />
        <path
          className="area"
          d="M0 74 C70 64 100 82 150 78 S230 95 285 91 S345 145 400 154 S470 112 520 106 S600 72 650 76 S710 54 760 43 L760 210 L0 210Z"
        />
        <path
          className="line"
          d="M0 74 C70 64 100 82 150 78 S230 95 285 91 S345 145 400 154 S470 112 520 106 S600 72 650 76 S710 54 760 43"
        />
        <circle className="focus-ring" cx="400" cy="154" r="8" />
        <circle className="focus-dot" cx="400" cy="154" r="4" />
      </svg>
      <div className="x-labels">
        {days.map((day, i) => (
          <button key={day} className={i === 4 ? "focus" : ""} onClick={onDay}>
            {day}
            <span>тра</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Attention({
  icon,
  tone,
  title,
  text,
  meta,
}: {
  icon: IconName
  tone: string
  title: string
  text: string
  meta: string
}) {
  return (
    <button className="attention-row">
      <span className={`status-icon ${tone}`}>
        <Icon name={icon} size={17} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <em>{meta}</em>
      <Icon name="chevron" size={15} />
    </button>
  )
}

function Efficiency({
  name,
  color,
  value,
  margin,
  width,
}: {
  name: string
  color: string
  value: string
  margin: string
  width: string
}) {
  return (
    <div className="efficiency-row">
      <span className="direction-name">
        <i style={{ background: color }} />
        {name}
      </span>
      <strong>{value}</strong>
      <em>{margin}</em>
      <span className="mini-bar">
        <i style={{ width, background: color }} />
      </span>
    </div>
  )
}

function Payment({
  date,
  month,
  title,
  account,
  amount,
  status,
}: {
  date: string
  month: string
  title: string
  account: string
  amount: string
  status: string
}) {
  return (
    <div className="payment-row">
      <div className="date-box">
        <strong>{date}</strong>
        <span>{month}</span>
      </div>
      <div>
        <strong>{title}</strong>
        <small>{account}</small>
      </div>
      <div className="payment-value">
        <strong>{amount}</strong>
        <span>{status}</span>
      </div>
    </div>
  )
}

function Planning({
  notify,
  project,
  setProject,
}: {
  notify: (v: string) => void
  project: Project
  setProject: (project: Project) => void
}) {
  const [step, setStep] = useState(1)
  const [rows, setRows] = useState([
    {
      name: "Оренда медичного центру",
      category: "Приміщення",
      date: "05.06",
      amount: 86000,
      regular: true,
      project: "Амбулаторія" as Project,
    },
    {
      name: "Медичні матеріали",
      category: "Закупівлі",
      date: "08.06",
      amount: 42800,
      regular: false,
      project: "Амбулаторія" as Project,
    },
    {
      name: "Лабораторні послуги",
      category: "Скринінг",
      date: "12.06",
      amount: 67400,
      regular: true,
      project: "Скринінг" as Project,
    },
    {
      name: "Зарплата й податки",
      category: "Команда",
      date: "30.06",
      amount: 418600,
      regular: true,
      project: "Психотерапія" as Project,
    },
  ])
  const visibleRows = rows.filter(
    (row) => project === "Усі напрями" || row.project === project,
  )
  const total = visibleRows.reduce((a, b) => a + b.amount, 0)
  if (step === 1)
    return (
      <>
        <ProjectSwitcher project={project} setProject={setProject} />
        <PageHeading
          eyebrow={`Планування · ${project} · червень 2027`}
          title="Створити платіжний план"
          subtitle="Оберіть основу — регулярні платежі перенесемо автоматично"
        />
        <div className="stepper">
          <span className="active">
            <i>1</i>Основа плану
          </span>
          <b />
          <span>
            <i>2</i>Редагування
          </span>
          <b />
          <span>
            <i>3</i>Підтвердження
          </span>
        </div>
        <div className="template-grid">
          <button className="template selected">
            <span className="radio" />
            <Icon name="calendar" size={24} />
            <strong>На основі травня</strong>
            <p>48 платежів · регулярні та незавершені</p>
            <small>Рекомендовано</small>
          </button>
          <button className="template">
            <span className="radio" />
            <Icon name="file" size={24} />
            <strong>З річного бюджету</strong>
            <p>Категорії та ліміти на червень</p>
          </button>
          <button className="template">
            <span className="radio" />
            <Icon name="plus" size={24} />
            <strong>Порожній план</strong>
            <p>Додати платежі вручну або імпортом</p>
          </button>
        </div>
        <section className="card carry-card">
          <div>
            <span className="status-icon amber">
              <Icon name="alert" size={17} />
            </span>
            <div>
              <strong>Перенести незавершені зобов’язання</strong>
              <p>3 платежі травня на суму 48 200 ₴ ще не закрито</p>
            </div>
          </div>
          <label className="switch">
            <input type="checkbox" defaultChecked />
            <span />
          </label>
        </section>
        <div className="footer-actions">
          <button className="secondary">Скасувати</button>
          <button className="primary" onClick={() => setStep(2)}>
            Продовжити <Icon name="arrow" size={16} />
          </button>
        </div>
      </>
    )
  return (
    <>
      <ProjectSwitcher project={project} setProject={setProject} />
      <PageHeading
        eyebrow={`Планування · ${project} · червень 2027`}
        title="Платіжний план на червень"
        subtitle="Редагуйте суми в таблиці або вставте дані з Excel / Google Sheets"
        actions={
          <>
            <button className="secondary">
              <Icon name="upload" size={16} /> Імпортувати
            </button>
            <button
              className="primary"
              onClick={() =>
                notify("План на червень створено й надіслано на погодження")
              }
            >
              <Icon name="check" size={16} /> Зберегти план
            </button>
          </>
        }
      />
      <div className="plan-summary">
        <div>
          <span>Заплановано</span>
          <strong>{formatMoney(total)}</strong>
        </div>
        <div>
          <span>Регулярні</span>
          <strong>38 платежів</strong>
        </div>
        <div>
          <span>Непокритий залишок</span>
          <strong className="positive">+524 300 ₴</strong>
        </div>
        <div className="summary-note">
          <Icon name="check" size={16} /> Прогноз ліквідності позитивний
        </div>
      </div>
      <section className="table-card">
        <div className="table-tools">
          <div className="tabs">
            <button className="active">
              {project === "Усі напрями" ? "Усі платежі" : project}{" "}
              <span>{visibleRows.length}</span>
            </button>
          </div>
          <button className="secondary small">
            <Icon name="plus" size={15} /> Додати рядок
          </button>
        </div>
        <div className="data-table plan-table">
          <div className="tr th">
            <span>
              <input type="checkbox" />
            </span>
            <span>Контрагент / призначення</span>
            <span>Категорія</span>
            <span>Дата</span>
            <span>Сума, ₴</span>
            <span>Тип</span>
            <span></span>
          </div>
          {visibleRows.map((row, i) => (
            <div className="tr" key={row.name}>
              <span>
                <input type="checkbox" />
              </span>
              <span>
                <strong>{row.name}</strong>
                <small>
                  {row.project === "Скринінг" ? "ТОВ «МедЛаб»" : row.project}
                </small>
              </span>
              <span>{row.category}</span>
              <span>{row.date}</span>
              <span>
                <input
                  className="money-input"
                  value={row.amount}
                  onChange={(e) =>
                    setRows(
                      rows.map((r) =>
                        r.name === row.name
                          ? { ...r, amount: Number(e.target.value) }
                          : r,
                      ),
                    )
                  }
                />
              </span>
              <span>
                {row.regular ? (
                  <em className="quiet-badge">Регулярний</em>
                ) : (
                  <em className="quiet-badge neutral">Разовий</em>
                )}
              </span>
              <span>
                <button>
                  <Icon name="more" size={16} />
                </button>
              </span>
            </div>
          ))}
          {(project === "Усі напрями" || project === "Амбулаторія") && (
            <div className="tr partial-row">
            <span>
              <input type="checkbox" />
            </span>
            <span>
              <strong>Борг за витратні матеріали</strong>
              <small>Перенесено з травня</small>
            </span>
            <span>Закупівлі</span>
            <span>03.06</span>
            <span>
              <strong>18 200</strong>
              <small>із 36 400 ₴</small>
            </span>
            <span>
              <em className="quiet-badge amber-badge">Часткова оплата</em>
            </span>
            <span>
              <button>
                <Icon name="more" size={16} />
              </button>
            </span>
            </div>
          )}
        </div>
        <div className="table-footer">
          <span>
            Показано {visibleRows.length} платежів · {project}
          </span>
          <strong>Разом: {formatMoney(total + 18200)}</strong>
        </div>
      </section>
    </>
  )
}

function Payroll({ notify }: { notify: (v: string) => void }) {
  const [tab, setTab] = useState<"work" | "statements" | "reconcile">("work")
  const [generated, setGenerated] = useState(false)
  return (
    <>
      <PageHeading
        eyebrow="Травень 2027"
        title="Зарплата"
        subtitle="Облік виробітку, нарахування та виплати"
        actions={<button className="secondary">Закрити місяць</button>}
      />
      <div className="module-tabs">
        <button
          className={tab === "work" ? "active" : ""}
          onClick={() => setTab("work")}
        >
          Табель і виробіток
        </button>
        <button
          className={tab === "statements" ? "active" : ""}
          onClick={() => setTab("statements")}
        >
          Платіжні відомості
        </button>
        <button
          className={tab === "reconcile" ? "active" : ""}
          onClick={() => setTab("reconcile")}
        >
          Виплати та борги
        </button>
      </div>
      {tab === "work" && <WorkLog onNext={() => setTab("statements")} />}
      {tab === "statements" && (
        <Statements
          generated={generated}
          generate={() => {
            setGenerated(true)
            notify("Три відомості сформовано")
          }}
          onReconcile={() => setTab("reconcile")}
        />
      )}
      {tab === "reconcile" && <Reconciliation />}
    </>
  )
}

function WorkLog({ onNext }: { onNext: () => void }) {
  const people = [
    ["Олена Коваль", "Лікарка", "21", "612", "—", "38"],
    ["Марія Левчук", "Медсестра", "20", "—", "184", "12"],
    ["Ірина Гнатюк", "Медсестра", "19", "—", "206", "8"],
    ["Саска", "Власниця · лікарка", "21", "548", "—", "42"],
  ]
  return (
    <section className="table-card">
      <div className="table-banner">
        <span className="status-icon blue">
          <Icon name="users" size={17} />
        </span>
        <div>
          <strong>Дані за 1–31 травня</strong>
          <p>
            Саска враховується у виробітку, але не входить до звітності найманих
            працівників.
          </p>
        </div>
        <span className="progress-label">Заповнено 94%</span>
      </div>
      <div className="data-table work-table">
        <div className="tr th">
          <span>Виконавець</span>
          <span>Робочі дні</span>
          <span>Декларації</span>
          <span>Скринінги</span>
          <span>Платні прийоми</span>
          <span>Статус</span>
        </div>
        {people.map((p, i) => (
          <div className="tr" key={p[0]}>
            <span>
              <div className={`person-avatar p${i}`}>{p[0][0]}</div>
              <div>
                <strong>{p[0]}</strong>
                <small>{p[1]}</small>
              </div>
            </span>
            {p.slice(2).map((v, j) => (
              <span key={j}>
                <input defaultValue={v} />
              </span>
            ))}
            <span>
              {i === 2 ? (
                <em className="quiet-badge amber-badge">Є розбіжність</em>
              ) : (
                <em className="quiet-badge">Перевірено</em>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="issue-row">
        <Icon name="alert" size={17} />
        <span>
          <strong>Розбіжність: 4 скринінги</strong> У реєстрі Скринінгу — 210, у
          табелі Ірини — 206.
        </span>
        <button>Порівняти записи</button>
      </div>
      <div className="footer-actions inside">
        <button className="secondary">Зберегти чернетку</button>
        <button className="primary" onClick={onNext}>
          Перейти до відомостей <Icon name="arrow" size={16} />
        </button>
      </div>
    </section>
  )
}

function Statements({
  generated,
  generate,
  onReconcile,
}: {
  generated: boolean
  generate: () => void
  onReconcile: () => void
}) {
  if (!generated)
    return (
      <div className="empty-state card">
        <span className="empty-icon">
          <Icon name="file" size={26} />
        </span>
        <h2>Відомості ще не сформовано</h2>
        <p>
          Система створить три окремі відомості з правильними рахунками
          списання.
        </p>
        <div className="statement-preview">
          <span>
            15 травня<small>Аванс · monobank</small>
          </span>
          <span>
            31 травня<small>Амбулаторія · monobank</small>
          </span>
          <span>
            31 травня<small>Скринінг · ПриватБанк</small>
          </span>
        </div>
        <button className="primary" onClick={generate}>
          Сформувати 3 відомості
        </button>
      </div>
    )
  const data = [
    ["15 тра", "Аванс · Амбулаторія", "monobank ФОП", "168 400 ₴", "Готова"],
    [
      "31 тра",
      "Зарплата · Амбулаторія",
      "monobank ФОП",
      "286 200 ₴",
      "На перевірці",
    ],
    ["31 тра", "Зарплата · Скринінг", "ПриватБанк ФОП", "142 800 ₴", "Готова"],
  ]
  return (
    <section className="table-card">
      <div className="table-tools">
        <div>
          <strong>Платіжні відомості</strong>
          <p>Суми на картки та пов’язані податки</p>
        </div>
        <button className="secondary small">Експорт у банк</button>
      </div>
      <div className="data-table statement-table">
        <div className="tr th">
          <span>Дата</span>
          <span>Відомість</span>
          <span>Рахунок списання</span>
          <span>На картки</span>
          <span>Податки</span>
          <span>Статус</span>
        </div>
        {data.map((r, i) => (
          <button className="tr" key={r[1]} onClick={onReconcile}>
            <span>{r[0]}</span>
            <span>
              <strong>{r[1]}</strong>
              <small>{i === 2 ? "2 отримувачі" : "3 отримувачі"}</small>
            </span>
            <span>{r[2]}</span>
            <span>
              <strong>{r[3]}</strong>
            </span>
            <span>{i === 0 ? "42 600 ₴" : "86 200 ₴"}</span>
            <span>
              <em className={`quiet-badge ${i === 1 ? "amber-badge" : ""}`}>
                {r[4]}
              </em>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function Reconciliation() {
  return (
    <div className="reconcile-grid">
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Звірка виплат</h2>
            <p>Відомість №2 · 31 травня</p>
          </div>
          <em className="quiet-badge amber-badge">1 розбіжність</em>
        </div>
        <div className="reconcile-total">
          <span>
            За відомістю<strong>286 200 ₴</strong>
          </span>
          <Icon name="arrow" />
          <span>
            Списано банком<strong>281 600 ₴</strong>
          </span>
        </div>
        <div className="issue-row">
          <Icon name="alert" size={17} />
          <span>
            <strong>Різниця 4 600 ₴</strong> Платіж Марії Левчук не знайдено у
            виписці.
          </span>
        </div>
        <button className="primary full">Знайти банківську операцію</button>
      </section>
      <section className="card owner-card">
        <span className="status-icon blue">
          <Icon name="user" />
        </span>
        <h2>Винагорода власниці</h2>
        <p>Обліковується окремо від зарплати найманих працівників.</p>
        <div>
          <span>Нараховано</span>
          <strong>74 800 ₴</strong>
        </div>
        <div>
          <span>Виплачено</span>
          <strong>50 000 ₴</strong>
        </div>
        <div>
          <span>Борг</span>
          <strong className="warning-text">24 800 ₴</strong>
        </div>
      </section>
    </div>
  )
}

function Taxes({ notify }: { notify: (v: string) => void }) {
  const [current, setCurrent] = useState(2)
  const labels = ["Розраховано", "Подано", "Прийнято", "Сплачено", "Зараховано"]
  return (
    <>
      <PageHeading
        eyebrow="I квартал 2027"
        title="Податки та звітність"
        subtitle="Контроль звітів, платежів і квитанцій"
        actions={
          <button
            className="primary"
            onClick={() => {
              setCurrent(Math.min(4, current + 1))
              notify("Статус звіту оновлено")
            }}
          >
            Оновити статус
          </button>
        }
      />
      <section className="card tax-hero">
        <div className="tax-title">
          <div className="file-mark">
            <Icon name="file" size={22} />
          </div>
          <div>
            <h2>Податковий розрахунок доходів працівників</h2>
            <p>Д1 / 4ДФ · 3 наймані працівники · Саска не включена</p>
          </div>
          <em className="quiet-badge">Квитанція №1 отримана</em>
        </div>
        <div className="tax-steps">
          {labels.map((l, i) => (
            <div
              className={`${i <= current ? "done" : ""} ${
                i === current ? "current" : ""
              }`}
              key={l}
            >
              <span>
                {i < current ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <strong>{l}</strong>
              <small>
                {
                  [
                    "12.05 · 09:24",
                    "12.05 · 10:08",
                    "очікуємо квитанцію №2",
                    "—",
                    "—",
                  ][i]
                }
              </small>
            </div>
          ))}
        </div>
      </section>
      <div className="tax-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Склад звіту</h2>
              <p>Перевірка перед поданням</p>
            </div>
            <span className="success-text">
              <Icon name="check" size={15} /> 6 із 6
            </span>
          </div>
          {[
            "Основний розрахунок",
            "Додаток Д1 · січень",
            "Додаток Д1 · лютий",
            "Додаток Д1 · березень",
            "4ДФ · I квартал",
          ].map((x, i) => (
            <div className="check-row" key={x}>
              <span>
                <Icon name="check" size={14} />
              </span>
              <div>
                <strong>{x}</strong>
                <small>
                  {i === 0
                    ? "Контрольні суми збігаються"
                    : "Перевірено · помилок немає"}
                </small>
              </div>
              <button>
                <Icon name="chevron" size={15} />
              </button>
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Сплата податків</h2>
              <p>Пов’язані банківські платежі</p>
            </div>
          </div>
          <div className="tax-payment">
            <span>
              ПДФО<strong>58 400 ₴</strong>
            </span>
            <em className="quiet-badge amber-badge">Заплановано · 17.05</em>
          </div>
          <div className="tax-payment">
            <span>
              ЄСВ<strong>27 800 ₴</strong>
            </span>
            <em className="quiet-badge">Сплачено</em>
          </div>
          <div className="tax-payment">
            <span>
              Військовий збір<strong>8 760 ₴</strong>
            </span>
            <em className="quiet-badge neutral">Не зараховано</em>
          </div>
          <div className="info-note">
            <Icon name="alert" size={16} /> Сплата ще не означає зарахування
            ДПС. Перевірте стан після 18 травня.
          </div>
        </section>
      </div>
    </>
  )
}

function Banks({
  setPanel,
  notify,
}: {
  setPanel: (v: "pos") => void
  notify: (v: string) => void
}) {
  const [tab, setTab] = useState("Операції")
  return (
    <>
      <PageHeading
        eyebrow="Гроші та банки"
        title="Рахунки й операції"
        subtitle="Рахунки можуть обслуговувати кілька напрямів"
        actions={
          <>
            <button
              className="secondary"
              onClick={() => notify("Імпорт виписки готовий")}
            >
              <Icon name="upload" size={16} /> Імпорт виписки
            </button>
            <button className="primary" onClick={() => setPanel("pos")}>
              <Icon name="split" size={16} /> Розподілити POS
            </button>
          </>
        }
      />
      <div className="account-strip">
        <Account
          bank="monobank"
          number="•• 4821"
          amount="824 600 ₴"
          color="#171717"
        />
        <Account
          bank="ПриватБанк"
          number="•• 1934"
          amount="382 400 ₴"
          color="#6b9c42"
        />
        <Account
          bank="Каса"
          number="готівка"
          amount="39 800 ₴"
          color="#a57a48"
        />
        <button className="add-account">
          <Icon name="plus" /> Додати рахунок
        </button>
      </div>
      <section className="table-card">
        <div className="table-tools">
          <div className="tabs">
            {["Операції", "Звірки", "Перекази", "Щоденний cash-flow"].map(
              (x) => (
                <button
                  className={tab === x ? "active" : ""}
                  onClick={() => setTab(x)}
                  key={x}
                >
                  {x}
                </button>
              ),
            )}
          </div>
          <div className="filter-pill">
            <Icon name="search" size={15} /> Пошук операцій
          </div>
        </div>
        <div className="data-table operations-table">
          <div className="tr th">
            <span>Дата</span>
            <span>Операція</span>
            <span>Рахунок</span>
            <span>Напрям</span>
            <span>Сума</span>
            <span>Стан</span>
          </div>
          <div className="tr pos-highlight" onClick={() => setPanel("pos")}>
            <span>11 тра</span>
            <span>
              <strong>Пакетне POS-надходження</strong>
              <small>Еквайринг · комісія не рознесена</small>
            </span>
            <span>monobank</span>
            <span>Не визначено</span>
            <span>
              <strong>+46 800 ₴</strong>
            </span>
            <span>
              <em className="quiet-badge amber-badge">Потребує розподілу</em>
            </span>
          </div>
          <div className="tr">
            <span>11 тра</span>
            <span>
              <strong>Оплата лабораторії</strong>
              <small>ТОВ «МедЛаб»</small>
            </span>
            <span>ПриватБанк</span>
            <span>Скринінг</span>
            <span>
              <strong>−24 200 ₴</strong>
            </span>
            <span>
              <em className="quiet-badge">Звірено</em>
            </span>
          </div>
          <div className="tr">
            <span>10 тра</span>
            <span>
              <strong>Надходження НСЗУ</strong>
              <small>Договір ПМГ</small>
            </span>
            <span>monobank</span>
            <span>Амбулаторія</span>
            <span>
              <strong>+428 600 ₴</strong>
            </span>
            <span>
              <em className="quiet-badge">Звірено</em>
            </span>
          </div>
        </div>
      </section>
    </>
  )
}

function Account({
  bank,
  number,
  amount,
  color,
}: {
  bank: string
  number: string
  amount: string
  color: string
}) {
  return (
    <div className="account-card">
      <span className="bank-dot" style={{ background: color }} />
      <div>
        <strong>{bank}</strong>
        <small>{number}</small>
      </div>
      <b>{amount}</b>
      <button>
        <Icon name="more" size={16} />
      </button>
    </div>
  )
}

function PersonalDashboard({ navigate }: { navigate: (v: Screen) => void }) {
  return (
    <>
      <PageHeading
        eyebrow="Особисті фінанси · травень"
        title="Вітаю, Саско"
        subtitle="Ваші гроші, резерв і цілі в одному просторі"
        actions={
          <button className="primary" onClick={() => navigate("planning")}>
            <Icon name="plus" size={16} /> Додати план
          </button>
        }
      />
      <div className="personal-balance">
        <div>
          <span>Загальний баланс</span>
          <strong>842 600 ₴</strong>
          <small>Еквівалент у всіх валютах</small>
        </div>
        <div className="currency-list">
          <span>
            <i>₴</i>
            <b>624 800</b>
            <small>UAH</small>
          </span>
          <span>
            <i>€</i>
            <b>3 200</b>
            <small>EUR</small>
          </span>
          <span>
            <i>$</i>
            <b>2 180</b>
            <small>USD</small>
          </span>
        </div>
        <div className="reserve-ring">
          <div>
            <strong>68%</strong>
            <small>резерву</small>
          </div>
          <span>
            <b>408 000 ₴</b> із 600 000 ₴
          </span>
        </div>
        <div className="balance-orbit" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="personal-grid">
        <section className="card spending-card">
          <div className="card-head">
            <div>
              <h2>Витрати у травні</h2>
              <p>Використано 54% місячного бюджету</p>
            </div>
            <strong>68 400 ₴</strong>
          </div>
          <div className="budget-progress">
            <i style={{ width: "54%" }} />
          </div>
          {[
            ["Житло", "24 600 ₴", "72%"],
            ["Щоденні витрати", "18 200 ₴", "48%"],
            ["Здоров’я", "9 800 ₴", "36%"],
            ["Дозвілля", "8 400 ₴", "44%"],
          ].map((r, i) => (
            <div className="category-row" key={r[0]}>
              <span>
                <i className={`cat c${i}`} />
                {r[0]}
              </span>
              <strong>{r[1]}</strong>
              <small>{r[2]}</small>
            </div>
          ))}
        </section>
        <section className="card goals-card">
          <div className="card-head">
            <div>
              <h2>Фінансові цілі</h2>
              <p>Прогрес накопичень</p>
            </div>
            <button
              className="link-button"
              onClick={() => navigate("forecast")}
            >
              Усі цілі
            </button>
          </div>
          <Goal
            name="Резерв на 6 місяців"
            value="408 000 із 600 000 ₴"
            progress={68}
          />
          <Goal
            name="Навчання у Відні"
            value="3 200 із 5 000 €"
            progress={64}
          />
          <Goal name="Відпустка" value="72 000 із 120 000 ₴" progress={60} />
        </section>
      </div>
      <section className="card recent">
        <div className="card-head">
          <div>
            <h2>Останні операції</h2>
            <p>Особисті рахунки</p>
          </div>
          <button className="link-button" onClick={() => navigate("banks")}>
            Усі операції
          </button>
        </div>
        <div className="recent-row">
          <span className="status-icon blue">
            <Icon name="arrow" size={16} />
          </span>
          <div>
            <strong>Переказ від ФОП</strong>
            <small>Винагорода власниці · без доходу вдруге</small>
          </div>
          <strong className="positive">+50 000 ₴</strong>
          <time>11 тра</time>
        </div>
        <div className="recent-row">
          <span className="status-icon amber">
            <Icon name="receipt" size={16} />
          </span>
          <div>
            <strong>Оренда квартири</strong>
            <small>Житло</small>
          </div>
          <strong>−22 000 ₴</strong>
          <time>10 тра</time>
        </div>
      </section>
    </>
  )
}

function Goal({
  name,
  value,
  progress,
}: {
  name: string
  value: string
  progress: number
}) {
  return (
    <div className="goal-row">
      <div>
        <strong>{name}</strong>
        <span>{progress}%</span>
      </div>
      <p>{value}</p>
      <div>
        <i style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function PersonalPlanning({ notify }: { notify: (v: string) => void }) {
  const [saved, setSaved] = useState(false)
  return (
    <>
      <PageHeading
        eyebrow="Особистий бюджет"
        title="План на червень"
        subtitle="Доходи, витрати, накопичення та фінансові цілі"
        actions={
          <button
            className="primary"
            onClick={() => {
              setSaved(true)
              notify("Особистий бюджет збережено")
            }}
          >
            <Icon name="check" size={16} /> Зберегти
          </button>
        }
      />
      <div className="personal-plan-grid">
        <section className="card">
          <h2>Розподіл доходу</h2>
          <p className="muted">Запланований дохід: 118 000 ₴</p>
          {[
            ["Обов’язкові витрати", "48 000", 41],
            ["Щоденні витрати", "24 000", 20],
            ["Резерв", "18 000", 15],
            ["Цілі й інвестиції", "20 000", 17],
          ].map((x, i) => (
            <div className="allocation" key={x[0]}>
              <span>
                <i className={`cat c${i}`} />
                {x[0]}
              </span>
              <input defaultValue={x[1]} />
              <small>{x[2]}%</small>
            </div>
          ))}
          <div className="allocation-total">
            <span>Нерозподілено</span>
            <strong>8 000 ₴</strong>
          </div>
        </section>
        <section className="card forecast-card">
          <h2>Прогноз на кінець червня</h2>
          <strong>686 800 ₴</strong>
          <p>Особисті ліквідні кошти</p>
          <div className="forecast-bars">
            <span>
              <i style={{ height: "62%" }} />
              <small>Тра</small>
            </span>
            <span>
              <i style={{ height: "74%" }} />
              <small>Чер</small>
            </span>
            <span>
              <i style={{ height: "82%" }} />
              <small>Лип</small>
            </span>
          </div>
          {saved && (
            <div className="success-banner">
              <Icon name="check" size={16} /> Бюджет затверджено
            </div>
          )}
        </section>
      </div>
    </>
  )
}

type ExpenseStatus = "planned" | "due" | "partial" | "paid"
type ExpenseItem = DemoExpense
type PendingPayment = DemoPending

const demoExpenses: ExpenseItem[] = [
  { id: 1, counterparty: "Оренда приміщення", category: "Оренда", project: "Амбулаторія", amount: 14000, due: "2027-06-05", bank: "monobank ФОП UAH", status: "due", paid: 0, note: "Стандартний щомісячний платіж" },
  { id: 2, counterparty: "Хелсі", category: "Програмне забезпечення", project: "Амбулаторія", amount: 1800, due: "2027-06-10", bank: "monobank ФОП UAH", status: "partial", paid: 800, note: "Залишок за рахунком" },
  { id: 3, counterparty: "Водоканал", category: "Комунальні платежі", project: "Амбулаторія", amount: 940, due: "2027-06-14", bank: "monobank ФОП UAH", status: "planned", paid: 0, note: "Суму потрібно перевірити" },
  { id: 4, counterparty: "Постачальник тестів", category: "Розхідні матеріали", project: "Скринінг", amount: 6200, due: "2027-06-19", bank: "ПриватБанк ФОП UAH", status: "due", paid: 0, note: "Замовлення підтверджене" },
  { id: 5, counterparty: "Розмова — комісія", category: "Комісія платформи", project: "Психотерапія", amount: 3100, due: "2027-06-22", bank: "monobank ФОП USD", status: "paid", paid: 3100, note: "Демо-звірка, сума у гривневому еквіваленті" },
]

const formatDemoMoney = (value: number) => new Intl.NumberFormat("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " ₴"

function ExpensesScreen({ project, setProject, navigate, notify }: {
  project: Project
  setProject: (p: Project) => void
  navigate: (s: Screen) => void
  notify: (s: string) => void
}) {
  // Browser-only demo persistence, NEVER for live financial data.
  const [initial] = useState(() => {
    try {
      const saved = readDemoSession(window.localStorage)
      return { items: saved?.items ?? demoExpenses, pending: saved?.pending ?? [] as PendingPayment[], error: "" }
    } catch (e) {
      return { items: demoExpenses, pending: [] as PendingPayment[], error: e instanceof Error ? e.message : "Зберігання недоступне" }
    }
  })
  const [items, setItems] = useState<ExpenseItem[]>(initial.items)
  const [pending, setPending] = useState<PendingPayment[]>(initial.pending)
  const [saveError, setSaveError] = useState(initial.error)
  const commitDemo = (nextItems: ExpenseItem[], nextPending: PendingPayment[]): boolean => {
    if (saveError) { notify("Запис заблоковано: " + saveError); return false }
    try {
      saveDemoSession(window.localStorage, { version: 1, items: nextItems, pending: nextPending })
      setItems(nextItems)
      setPending(nextPending)
      return true
    } catch (e) {
      const problem = e instanceof Error ? e.message : "Помилка збереження"
      setSaveError(problem)
      notify("Не збережено: " + problem)
      return false
    }
  }
  const [view, setView] = useState<"obligations" | "reconcile">("obligations")
  const [statusFilter, setStatusFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [form, setForm] = useState<"new" | "pay" | null>(null)
  const [activeId, setActiveId] = useState(1)
  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState("Послуги")
  const [newProject, setNewProject] = useState<Exclude<Project,"Усі напрями">>("Амбулаторія")
  const [newAmount, setNewAmount] = useState("")
  const [newDue, setNewDue] = useState("2027-06-25")
  const [newBank, setNewBank] = useState("monobank ФОП UAH")
  const [newNote, setNewNote] = useState("")
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState("2027-06-20")
  const [payBank, setPayBank] = useState("monobank ФОП UAH")
  const [payNote, setPayNote] = useState("")
  const [previewId, setPreviewId] = useState<number|null>(null)
  const opened = items.find(r => r.id === activeId)
  const visible = items.filter(r => (project === "Усі напрями" || r.project === project) &&
    (statusFilter === "all" || r.status === statusFilter) &&
    `${r.counterparty} ${r.category}`.toLowerCase().includes(query.toLowerCase()))
  const scoped = items.filter(r => project === "Усі напрями" || r.project === project)
  const total = scoped.reduce((s,r) => s+r.amount,0)
  const paid = scoped.reduce((s,r) => s+r.paid,0)
  const outstanding = Math.max(0,total-paid)
  const overdue = scoped.filter(r => r.status !== "paid" && r.due < "2027-06-18").reduce((s,r)=>s+r.amount-r.paid,0)
  const statusName = (r: ExpenseItem) => r.paid >= r.amount ? "Оплачено" : r.paid>0 ? "Частково" : r.status === "planned" ? "Заплановано" : "До оплати"
  const startPay = (r: ExpenseItem) => {
    setActiveId(r.id);setPayAmount(((Math.max(0,toMinor(r.amount)-toMinor(r.paid)))/100).toFixed(2))
    setPayBank(r.bank);setPayDate("2027-06-20");setPayNote("");setForm("pay")
  }
  const create = (e: React.FormEvent) => {
    e.preventDefault()
    let amount: number
    try { amount = toKopiykas(newAmount) / 100 } catch (e) { notify((e as Error).message); return }
    if (!newName.trim() || amount <= 0) return
    const next = [...items,{id:Math.max(...items.map(r=>r.id),0)+1,counterparty:newName.trim(),category:newCategory,project:newProject,amount,due:newDue,bank:newBank,status:"planned" as const,paid:0,note:newNote}]
    if (!commitDemo(next, pending)) return
    setForm(null);setNewName("");setNewAmount("");setNewNote("")
    notify("Тестове зобов’язання збережено в цьому браузері")
  }
  const preparePayment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!opened) return
    let amountMinor: number
    try { amountMinor = toKopiykas(payAmount) } catch (e) { notify((e as Error).message); return }
    const remainingMinor = toMinor(opened.amount) - toMinor(opened.paid)
    if (amountMinor <= 0 || amountMinor > remainingMinor) { notify("Платіж перевищує залишок"); return }
    const queuedMinor = pending.filter(p=>p.obligationId===opened.id).reduce((s,p)=>s+toMinor(p.amount),0)
    if (amountMinor + queuedMinor > remainingMinor) {
      notify("Сума перевищує залишок з урахуванням непідтверджених платежів")
      return
    }
    const next = [...pending,{id:Math.max(...pending.map(x=>x.id),0)+1,obligationId:opened.id,date:payDate,amount:amountMinor/100,bank:payBank,note:payNote}]
    if (!commitDemo(items, next)) return
    setForm(null);setView("reconcile")
    notify("Тестовий платіж збережено; борг не зменшено до демопідтвердження")
  }
  const confirmDemo = (p: PendingPayment) => {
    const r = items.find(x=>x.id===p.obligationId)
    if (!r || toMinor(r.paid)+toMinor(p.amount)>toMinor(r.amount)) return
    const updatedPaid = (toMinor(r.paid)+toMinor(p.amount))/100
    const nextItems = items.map(x=>x.id!==r.id?x:{...x,paid:updatedPaid,status:(toMinor(updatedPaid)>=toMinor(x.amount)?"paid":"partial") as ExpenseStatus})
    if (!commitDemo(nextItems,pending.filter(x=>x.id!==p.id))) return
    notify("Лише демопідтвердження: борг оновлено і збережено, банківської звірки немає")
  }
  return <>
    <ProjectSwitcher project={project} setProject={setProject} />
    <PageHeading eyebrow="Операційний облік · червень 2027 · демонстраційні дані" title="Витрати та зобов’язання"
      subtitle="Зобов’язання, очікувані платежі й фактичне погашення — три різні події"
      actions={<><button className="secondary" onClick={()=>navigate("planning")}><Icon name="calendar" size={16}/> План наступного місяця</button>
        <button className="primary" onClick={()=>setForm("new")}><Icon name="plus" size={16}/> Нове зобов’язання</button></>}/>
    <div className="expenses-notice"><Icon name="alert" size={16}/><span><strong>Тільки тестові дані.</strong> Записи зберігаються в цьому браузері й залишаються після перезавантаження. Це НЕ серверна база, НЕ банківська звірка; реальні фінанси не вводити. {saveError && <strong role="alert"> Помилка сховища: {saveError}. Нові записи заблоковані, дані не видалено.</strong>}</span></div>
    <div className="expenses-summary">
      <div className="expense-kpi"><span>Усього зобов’язань</span><strong>{formatDemoMoney(total)}</strong><small>{scoped.length} записів</small></div>
      <div className="expense-kpi"><span>Погашено (демо)</span><strong>{formatDemoMoney(paid)}</strong><small>Не є банківським підтвердженням</small></div>
      <div className="expense-kpi"><span>Залишок до сплати</span><strong>{formatDemoMoney(outstanding)}</strong><small>Включно з плановими</small></div>
      <div className="expense-kpi danger"><span>Після умовного строку</span><strong>{formatDemoMoney(overdue)}</strong><small>Зріз демонстрації 18.06.2027</small></div>
    </div>
    <section className="table-card expense-register">
      <div className="table-tools expense-toolbar">
        <div className="tabs"><button className={view==="obligations"?"active":""} onClick={()=>setView("obligations")}>Реєстр зобов’язань <span>{visible.length}</span></button>
          <button className={view==="reconcile"?"active":""} onClick={()=>setView("reconcile")}>Очікують звірки <span>{pending.length}</span></button></div>
        {view==="obligations" && <div className="expense-filters"><input aria-label="Пошук контрагента" placeholder="Пошук контрагента або категорії" value={query} onChange={e=>setQuery(e.target.value)}/>
          <select aria-label="Фільтр статусу" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Усі статуси</option><option value="planned">Заплановано</option><option value="due">До оплати</option><option value="partial">Частково</option><option value="paid">Оплачено</option></select></div>}
      </div>
      {view==="obligations" ? <div className="expense-scroll"><table className="expense-table"><thead><tr><th>Контрагент / призначення</th><th>Проєкт</th><th>Категорія</th><th>Строк</th><th>Сума</th><th>Погашено</th><th>Залишок</th><th>Статус</th><th></th></tr></thead><tbody>
        {visible.map(r=><tr key={r.id}><td><button className="expense-link" onClick={()=>setPreviewId(previewId===r.id?null:r.id)}>{r.counterparty}</button><small>{r.bank}</small></td><td>{r.project}</td><td>{r.category}</td><td>{r.due.split("-").reverse().join(".")}</td><td className="num">{formatDemoMoney(r.amount)}</td><td className="num">{formatDemoMoney(r.paid)}</td><td className="num weight">{formatDemoMoney(r.amount-r.paid)}</td><td><span className={`expense-status ${r.paid>=r.amount?"ok":r.paid>0?"part":r.status}`}>{statusName(r)}</span></td><td>{r.paid<r.amount && <button className="secondary small" onClick={()=>startPay(r)}>Платіж</button>}</td></tr>)}
        {visible.length===0 && <tr><td colSpan={9} className="expenses-empty">За заданими фільтрами записів немає.</td></tr>}
      </tbody></table></div> : <div className="expense-pending">
        {pending.length===0 ? <div className="expenses-empty">Поки немає платежів, які очікують звірки. Натисни «Платіж» біля зобов’язання, щоб додати тестовий запис.</div> : pending.map(p=>{const r=items.find(x=>x.id===p.obligationId);return <div className="expense-pending-row" key={p.id}><div><strong>{r?.counterparty}</strong><small>{p.date.split("-").reverse().join(".")} · {p.bank} · статус «очікує підтвердження»</small></div><b>{formatDemoMoney(p.amount)}</b><button className="secondary small" onClick={()=>confirmDemo(p)}>Підтвердити в демо</button><button className="expense-remove" aria-label="Видалити підготовлений платіж" onClick={()=>commitDemo(items,pending.filter(x=>x.id!==p.id))}><Icon name="close" size={15}/></button></div>})}
      </div>}
      {previewId!==null && view==="obligations" && (()=>{const r=items.find(x=>x.id===previewId);return r?<div className="expense-detail"><strong>Деталі: {r.counterparty}</strong><span>Проєкт: {r.project} · {r.category}</span><span>Строк оплати: {r.due.split("-").reverse().join(".")} · Плановий банк: {r.bank}</span><span>{r.note||"Без примітки"}</span><span>План: {formatDemoMoney(r.amount)} · Оплачено: {formatDemoMoney(r.paid)} · Борг: {formatDemoMoney(r.amount-r.paid)}</span></div>:null})()}
    </section>
    <div className="expense-footnote">Нарахування зарплати й податкові платежі в повній системі з’являтимуться в загальному календарі автоматично з їхніх модулів, без повторного ручного введення.</div>
    {form && <div className="expense-modal-backdrop" onClick={()=>setForm(null)}><section className="expense-modal" role="dialog" aria-modal="true" aria-label={form==="new"?"Нове зобов’язання":"Підготувати платіж"} onClick={e=>e.stopPropagation()}><div className="expense-modal-head"><div><span>Тестове введення · цей браузер</span><h2>{form==="new"?"Нове зобов’язання":"Підготувати платіж"}</h2></div><button onClick={()=>setForm(null)} aria-label="Закрити"><Icon name="close"/></button></div>
      {form==="new" ? <form onSubmit={create}><label>Контрагент або назва<input required value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Наприклад, оренда приміщення"/></label><div className="expense-form-grid"><label>Проєкт<select value={newProject} onChange={e=>setNewProject(e.target.value as Exclude<Project,"Усі напрями">)}><option>Амбулаторія</option><option>Скринінг</option><option>Психотерапія</option></select></label><label>Категорія<select value={newCategory} onChange={e=>setNewCategory(e.target.value)}>{["Послуги","Оренда","Програмне забезпечення","Комунальні платежі","Розхідні матеріали","Обладнання","Інше"].map(x=><option key={x}>{x}</option>)}</select></label><label>Планова сума, ₴<input type="number" min="0.01" step="0.01" required value={newAmount} onChange={e=>setNewAmount(e.target.value)}/></label><label>Очікуваний строк<input type="date" required value={newDue} onChange={e=>setNewDue(e.target.value)}/></label></div><label>Рахунок оплати<select value={newBank} onChange={e=>setNewBank(e.target.value)}>{["monobank ФОП UAH","ПриватБанк ФОП UAH","monobank ФОП USD"].map(x=><option key={x}>{x}</option>)}</select></label><label>Примітка<textarea value={newNote} onChange={e=>setNewNote(e.target.value)} rows={2}/></label><div className="expense-modal-actions"><button type="button" className="secondary" onClick={()=>setForm(null)}>Скасувати</button><button type="submit" className="primary">Зберегти тестове зобов’язання</button></div></form> : <form onSubmit={preparePayment}><div className="expense-callout"><strong>{opened?.counterparty}</strong><span>Непогашений залишок: {formatDemoMoney((opened?.amount||0)-(opened?.paid||0))}</span><span>Запланована оплата не зменшує борг до звірки.</span></div><div className="expense-form-grid"><label>Сума, ₴<input type="number" required min="0.01" max={opened?.amount} step="0.01" value={payAmount} onChange={e=>setPayAmount(e.target.value)}/></label><label>Дата платежу<input type="date" required value={payDate} onChange={e=>setPayDate(e.target.value)}/></label></div><label>Банк списання<select value={payBank} onChange={e=>setPayBank(e.target.value)}>{["monobank ФОП UAH","ПриватБанк ФОП UAH","monobank ФОП USD"].map(x=><option key={x}>{x}</option>)}</select></label><label>Примітка<textarea rows={2} value={payNote} onChange={e=>setPayNote(e.target.value)} placeholder="Призначення або уточнення"/></label><div className="expense-modal-actions"><button type="button" className="secondary" onClick={()=>setForm(null)}>Скасувати</button><button type="submit" className="primary">Додати до черги звірки</button></div></form>}
    </section></div>}
  </>
}

function GenericScreen({ screen }: { screen: Screen }) {
  const map: Partial<Record<Screen, [string, string]>> = {
    income: [
      "Доходи й ефективність",
      "Зароблений дохід, отримані кошти та операційні показники",
    ],
    expenses: [
      "Витрати та зобов’язання",
      "Планові платежі, фактичні витрати, борги й часткові оплати",
    ],
    forecast: [
      "Бюджет і прогноз",
      "Затверджений бюджет, факт і динамічний прогноз",
    ],
    analytics: [
      "Аналітика й контроль",
      "Відхилення, помилки й пояснення до управлінських показників",
    ],
    settings: [
      "Налаштування",
      "Рахунки, категорії, ролі та правила автоматизації",
    ],
  }
  const [title, subtitle] = map[screen] || ["Розділ", ""]
  return (
    <>
      <PageHeading title={title} subtitle={subtitle} />
      <div className="generic-grid">
        <section className="card generic-chart">
          <div className="card-head">
            <div>
              <h2>Динаміка за 6 місяців</h2>
              <p>Факт проти плану</p>
            </div>
            <div className="filter-pill">Усі напрями</div>
          </div>
          <div className="bar-chart">
            {[54, 68, 62, 81, 74, 88].map((h, i) => (
              <span key={i}>
                <i style={{ height: `${h}%` }} />
                <b style={{ height: `${h - 12}%` }} />
                <small>{["Гру", "Січ", "Лют", "Бер", "Кві", "Тра"][i]}</small>
              </span>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Контрольні показники</h2>
          {[
            ["Виконання плану", "94,8%"],
            ["Зміна до попереднього місяця", "+8,4%"],
            ["Потребує пояснення", "3 відхилення"],
          ].map((x) => (
            <div className="stat-row" key={x[0]}>
              <span>{x[0]}</span>
              <strong>{x[1]}</strong>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}

const projectData: Record<
  Project,
  {
    revenue: string
    received: string
    result: string
    margin: string
    primaryLabel: string
    primaryValue: string
    secondaryLabel: string
    secondaryValue: string
    bars: number[]
  }
> = {
  "Усі напрями": {
    revenue: "2 218 200 ₴",
    received: "2 046 800 ₴",
    result: "634 200 ₴",
    margin: "28,6%",
    primaryLabel: "Джерел доходу",
    primaryValue: "7",
    secondaryLabel: "Різниця нараховано / отримано",
    secondaryValue: "171 400 ₴",
    bars: [58, 66, 62, 74, 81, 88],
  },
  Амбулаторія: {
    revenue: "1 342 000 ₴",
    received: "1 286 400 ₴",
    result: "418 600 ₴",
    margin: "31,2%",
    primaryLabel: "Активні декларації",
    primaryValue: "2 846",
    secondaryLabel: "Дохід НСЗУ / декларацію",
    secondaryValue: "382 ₴",
    bars: [62, 68, 66, 79, 84, 91],
  },
  Скринінг: {
    revenue: "612 400 ₴",
    received: "548 200 ₴",
    result: "151 900 ₴",
    margin: "24,8%",
    primaryLabel: "Виконано скринінгів",
    primaryValue: "418",
    secondaryLabel: "Середній дохід / скринінг",
    secondaryValue: "1 465 ₴",
    bars: [42, 51, 57, 64, 76, 86],
  },
  Психотерапія: {
    revenue: "263 800 ₴",
    received: "212 200 ₴",
    result: "111 100 ₴",
    margin: "42,1%",
    primaryLabel: "Активні пацієнти",
    primaryValue: "38",
    secondaryLabel: "Проведено сесій",
    secondaryValue: "126",
    bars: [55, 61, 58, 70, 73, 81],
  },
}

function IncomeScreen({
  project,
  setProject,
}: {
  project: Project
  setProject: (project: Project) => void
}) {
  const data = projectData[project]
  const sources =
    project === "Амбулаторія"
      ? [
          ["НСЗУ · декларації", "1 086 400 ₴", "Отримано 1 042 000 ₴"],
          ["Платні послуги", "255 600 ₴", "Отримано 244 400 ₴"],
        ]
      : project === "Скринінг"
        ? [
            ["Корпоративні скринінги", "438 200 ₴", "312 виконань"],
            ["Індивідуальні програми", "174 200 ₴", "106 виконань"],
          ]
        : project === "Психотерапія"
          ? [
              ["Індивідуальні сесії", "226 800 ₴", "Комісії 18 400 ₴"],
              ["Групові зустрічі", "37 000 ₴", "Комісії 3 200 ₴"],
            ]
          : [
              ["Амбулаторія", "1 342 000 ₴", "60,5% доходу"],
              ["Скринінг", "612 400 ₴", "27,6% доходу"],
              ["Психотерапія", "263 800 ₴", "11,9% доходу"],
            ]
  return (
    <>
      <ProjectSwitcher project={project} setProject={setProject} />
      <PageHeading
        eyebrow="Травень 2027 · управлінський облік"
        title="Доходи й ефективність"
        subtitle="Зароблений дохід відокремлено від фактично отриманих коштів"
        actions={<button className="secondary">Експорт звіту</button>}
      />
      <div className="metric-grid project-metrics">
        <Metric
          label="Зароблений дохід"
          value={data.revenue}
          note="За надані послуги"
          trend="+8,4% до квітня"
        />
        <Metric
          label="Фактично отримано"
          value={data.received}
          note="За банківськими операціями"
          trend="92,3% нарахованого"
        />
        <Metric
          label="Управлінський результат"
          value={data.result}
          note="Не дорівнює залишку грошей"
          trend={`Маржа ${data.margin}`}
        />
        <Metric
          label={data.primaryLabel}
          value={data.primaryValue}
          note={data.secondaryLabel}
          trend={data.secondaryValue}
        />
      </div>
      <div className="income-layout">
        <section className="card project-chart-card">
          <div className="card-head">
            <div>
              <h2>Динаміка заробленого доходу</h2>
              <p>Факт проти плану · 6 місяців</p>
            </div>
            <div className="chart-key">
              <span>
                <i /> Факт
              </span>
              <span>
                <i /> План
              </span>
            </div>
          </div>
          <ProjectBarChart bars={data.bars} />
        </section>
        <section className="card source-card">
          <div className="card-head">
            <div>
              <h2>Структура доходу</h2>
              <p>{project} · травень</p>
            </div>
          </div>
          {sources.map((source, index) => (
            <div className="income-source" key={source[0]}>
              <span className={`source-number n${index + 1}`}>0{index + 1}</span>
              <div>
                <strong>{source[0]}</strong>
                <small>{source[2]}</small>
              </div>
              <b>{source[1]}</b>
            </div>
          ))}
        </section>
      </div>
      {project === "Психотерапія" && (
        <div className="project-note">
          <Icon name="shield" size={17} />
          <span>
            <strong>Приватність збережено.</strong> У фінансовому контурі немає
            імен пацієнтів або змісту сесій — лише агреговані показники.
          </span>
        </div>
      )}
    </>
  )
}

function ProjectBarChart({ bars }: { bars: number[] }) {
  return (
    <div className="project-bars">
      {bars.map((height, index) => (
        <span key={index}>
          <i style={{ height: `${height}%` }} />
          <b style={{ height: `${Math.max(height - 9, 20)}%` }} />
          <small>{["Гру", "Січ", "Лют", "Бер", "Кві", "Тра"][index]}</small>
        </span>
      ))}
    </div>
  )
}

function ForecastScreen({
  project,
  setProject,
}: {
  project: Project
  setProject: (project: Project) => void
}) {
  const [scenario, setScenario] = useState("Базовий")
  const data = projectData[project]
  const scenarioDelta =
    scenario === "Оптимістичний"
      ? "+184 000 ₴"
      : scenario === "Обережний"
        ? "−126 000 ₴"
        : "+42 000 ₴"
  return (
    <>
      <ProjectSwitcher project={project} setProject={setProject} />
      <PageHeading
        eyebrow="2027 · річний горизонт"
        title="Бюджет і прогноз"
        subtitle="Затверджений бюджет незмінний; прогноз оновлюється за фактом і планами"
        actions={
          <button className="secondary">
            <Icon name="file" size={16} /> Пояснення відхилень
          </button>
        }
      />
      <div className="forecast-top">
        <section className="budget-lock">
          <span className="lock-icon">
            <Icon name="shield" />
          </span>
          <div>
            <small>ЗАТВЕРДЖЕНИЙ БЮДЖЕТ · 2027</small>
            <strong>
              {project === "Усі напрями" ? "24 800 000 ₴" : data.revenue}
            </strong>
            <p>Версія від 18 грудня 2026 · зміни заблоковано</p>
          </div>
          <em>База порівняння</em>
          <div className="budget-mini-graphic" aria-hidden="true">
            <svg viewBox="0 0 112 38" preserveAspectRatio="none">
              <path d="M2 31C18 29 20 19 35 22S54 27 66 15 85 18 110 4" />
              <circle cx="110" cy="4" r="3" />
            </svg>
          </div>
        </section>
        <div className="scenario-control">
          <span>Сценарій прогнозу</span>
          <div>
            {["Обережний", "Базовий", "Оптимістичний"].map((item) => (
              <button
                key={item}
                className={scenario === item ? "active" : ""}
                onClick={() => setScenario(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="forecast-kpis">
        <div>
          <span>Факт січень–травень</span>
          <strong>{data.revenue}</strong>
          <small>94,8% плану періоду</small>
        </div>
        <div>
          <span>Прогноз до кінця року</span>
          <strong>
            {project === "Усі напрями" ? "25 426 000 ₴" : data.received}
          </strong>
          <small className="project-positive">{scenarioDelta} до бюджету</small>
        </div>
        <div>
          <span>Прогнозований результат</span>
          <strong>{data.result}</strong>
          <small>Маржа {data.margin}</small>
        </div>
        <div>
          <span>Прогноз коштів 31.12</span>
          <strong>2 184 000 ₴</strong>
          <small>Окремо від прибутку</small>
        </div>
      </div>
      <div className="forecast-layout">
        <section className="card annual-chart">
          <div className="card-head">
            <div>
              <h2>Бюджет · факт · прогноз</h2>
              <p>Щомісячна управлінська динаміка</p>
            </div>
            <div className="chart-key">
              <span><i /> Бюджет</span>
              <span><i /> Факт / прогноз</span>
            </div>
          </div>
          <div className="annual-bars">
            {[62, 68, 65, 76, 82, 74, 78, 85, 88, 91, 94, 98].map(
              (height, index) => (
                <span key={index} className={index > 4 ? "future" : ""}>
                  <i style={{ height: `${height - 7}%` }} />
                  <b style={{ height: `${height}%` }} />
                  <small>
                    {
                      [
                        "Січ",
                        "Лют",
                        "Бер",
                        "Кві",
                        "Тра",
                        "Чер",
                        "Лип",
                        "Сер",
                        "Вер",
                        "Жов",
                        "Лис",
                        "Гру",
                      ][index]
                    }
                  </small>
                </span>
              ),
            )}
          </div>
        </section>
        <section className="card variance-card">
          <div className="card-head">
            <div>
              <h2>Ключові відхилення</h2>
              <p>Вплив на прогноз року</p>
            </div>
          </div>
          {[
            ["Доходи НСЗУ", "+126 000 ₴", "Вище плану"],
            ["Лабораторні витрати", "−84 600 ₴", "Потребує пояснення"],
            ["Фонд оплати праці", "−42 000 ₴", "У межах допуску"],
          ].map((row, index) => (
            <div className="variance-row" key={row[0]}>
              <span className={index === 0 ? "up" : "down"}>
                {index === 0 ? "↑" : "↓"}
              </span>
              <div>
                <strong>{row[0]}</strong>
                <small>{row[2]}</small>
              </div>
              <b>{row[1]}</b>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}

function AnalyticsScreen({
  project,
  setProject,
}: {
  project: Project
  setProject: (project: Project) => void
}) {
  const data = projectData[project]
  return (
    <>
      <ProjectSwitcher project={project} setProject={setProject} />
      <PageHeading
        eyebrow="Контроль якості даних · 12 травня"
        title="Аналітика й контроль"
        subtitle="Відхилення мають пояснення, а кожен показник — шлях до першоджерела"
        actions={<button className="secondary">Налаштувати правила</button>}
      />
      <div className="control-strip">
        <div className="control-score">
          <div><strong>92</strong><small>/ 100</small></div>
          <span><b>Якість фінансових даних</b><small>Висока · +4 бали за тиждень</small></span>
        </div>
        <div><span>Звірено операцій</span><strong>98,4%</strong></div>
        <div><span>Без категорії</span><strong>6</strong></div>
        <div><span>Відхилень від бюджету</span><strong>3</strong></div>
        <div><span>Незакритих періодів</span><strong>1</strong></div>
      </div>
      <div className="analytics-layout">
        <section className="card deviation-card">
          <div className="card-head">
            <div>
              <h2>Відхилення, які потребують рішення</h2>
              <p>{project} · від найбільшого впливу</p>
            </div>
            <button className="link-button">Усі 8</button>
          </div>
          {[
            ["Лабораторні послуги", "Витрати на 18,6% вище бюджету", "−84 600 ₴", "Високий"],
            ["Платні послуги", "Отримано на 11 200 ₴ менше нарахованого", "11 200 ₴", "Середній"],
            ["POS за 11 травня", "Не завершено розподіл між напрямами", "46 800 ₴", "Середній"],
          ].map((item, index) => (
            <div className="deviation-row" key={item[0]}>
              <span className={`deviation-index d${index}`}>0{index + 1}</span>
              <div>
                <strong>{item[0]}</strong>
                <small>{item[1]}</small>
              </div>
              <b>{item[2]}</b>
              <em>{item[3]}</em>
              <button><Icon name="chevron" size={15} /></button>
            </div>
          ))}
        </section>
        <section className="card audit-card">
          <div className="card-head">
            <div>
              <h2>Контур контролю</h2>
              <p>Повнота ключових звірок</p>
            </div>
          </div>
          {[
            ["Банки й каса", 98],
            ["Доходи та послуги", 94],
            ["Зобов’язання", 88],
            ["Зарплата", 96],
            ["Податки", 84],
          ].map((item) => (
            <div className="audit-row" key={item[0]}>
              <div><strong>{item[0]}</strong><span>{item[1]}%</span></div>
              <div><i style={{ width: `${item[1]}%` }} /></div>
            </div>
          ))}
        </section>
      </div>
      <section className="card insight-card">
        <span className="insight-number">01</span>
        <div>
          <small>АВТОМАТИЧНЕ СПОСТЕРЕЖЕННЯ</small>
          <strong>Маржа {project.toLowerCase()} знижується другий місяць</strong>
          <p>
            Поточна маржа {data.margin}. Найбільший вплив мають лабораторні
            витрати та відставання фактичних надходжень.
          </p>
        </div>
        <button className="secondary">Відкрити пояснення</button>
      </section>
    </>
  )
}

function PersonalGeneric({ screen }: { screen: Screen }) {
  return (
    <>
      <PageHeading
        title={
          personalNav.find((x) => x.id === screen)?.label || "Налаштування"
        }
        subtitle="Особисті дані відокремлені від операційного обліку бізнесу"
      />
      <section className="card simple-list">
        <div className="card-head">
          <div>
            <h2>Огляд</h2>
            <p>Демонстраційні дані за травень</p>
          </div>
          <button className="primary compact">
            <Icon name="plus" size={15} /> Додати
          </button>
        </div>
        {[
          ["Основний особистий рахунок", "284 600 ₴"],
          ["Валютні заощадження", "3 200 €"],
          ["Резерв", "408 000 ₴"],
        ].map((x) => (
          <div className="simple-row" key={x[0]}>
            <span className="status-icon blue">
              <Icon name="wallet" size={16} />
            </span>
            <strong>{x[0]}</strong>
            <b>{x[1]}</b>
            <Icon name="chevron" size={15} />
          </div>
        ))}
      </section>
    </>
  )
}

function DayPanel({ close }: { close: () => void }) {
  return (
    <div className="drawer-wrap">
      <button className="drawer-scrim" onClick={close} aria-label="Закрити" />
      <aside className="drawer">
        <div className="drawer-head">
          <div>
            <span>Cash-flow · травень</span>
            <h2>Вівторок, 20 травня</h2>
          </div>
          <button onClick={close}>
            <Icon name="close" />
          </button>
        </div>
        <div className="day-balance">
          <span>Прогноз на кінець дня</span>
          <strong>742 000 ₴</strong>
          <em>−216 400 ₴ за день</em>
        </div>
        <div className="flow-summary">
          <span>
            Початок дня<strong>958 400 ₴</strong>
          </span>
          <span className="positive">
            Надходження<strong>+42 000 ₴</strong>
          </span>
          <span className="negative">
            Списання<strong>−258 400 ₴</strong>
          </span>
        </div>
        <h3>Фінансові події</h3>
        <div className="event">
          <span className="event-time">09:00</span>
          <i className="out" />
          <div>
            <strong>Оренда й комунальні</strong>
            <small>monobank · Амбулаторія</small>
          </div>
          <b>−74 600 ₴</b>
        </div>
        <div className="event">
          <span className="event-time">12:00</span>
          <i className="in" />
          <div>
            <strong>Оплати за психотерапію</strong>
            <small>Очікуване надходження</small>
          </div>
          <b className="positive">+42 000 ₴</b>
        </div>
        <div className="event">
          <span className="event-time">16:00</span>
          <i className="out" />
          <div>
            <strong>Зарплатні податки</strong>
            <small>ПриватБанк · 3 платежі</small>
          </div>
          <b>−183 800 ₴</b>
        </div>
        <div className="info-note">
          <Icon name="alert" size={16} /> Залишок вищий за мінімальний резерв на
          242 000 ₴.
        </div>
        <button className="secondary full">Відкрити щоденний cash-flow</button>
      </aside>
    </div>
  )
}

function TransferPanel({
  close,
  done,
}: {
  close: () => void
  done: () => void
}) {
  return (
    <Modal
      close={close}
      title="Переказ власниці"
      subtitle="Між бізнесовим і особистим просторами"
    >
      <div className="transfer-visual">
        <span>
          <Icon name="building" />
          <b>monobank ФОП</b>
          <small>824 600 ₴</small>
        </span>
        <Icon name="arrow" />
        <span>
          <Icon name="user" />
          <b>Особистий рахунок</b>
          <small>284 600 ₴</small>
        </span>
      </div>
      <label className="field">
        Сума, ₴<input defaultValue="50 000" />
      </label>
      <label className="field">
        Тип операції
        <select defaultValue="owner">
          <option value="owner">Винагорода власниці</option>
          <option>Повернення коштів</option>
        </select>
      </label>
      <div className="info-note">
        <Icon name="shield" size={16} /> В особистому просторі операція
        з’явиться як внутрішній переказ, а не новий дохід.
      </div>
      <div className="modal-actions">
        <button className="secondary" onClick={close}>
          Скасувати
        </button>
        <button className="primary" onClick={done}>
          Підтвердити переказ
        </button>
      </div>
    </Modal>
  )
}

function PosPanel({ close, done }: { close: () => void; done: () => void }) {
  const [ambulatory, setAmbulatory] = useState(28600)
  const total = 46800,
    fee = 936,
    screening = total - ambulatory
  return (
    <Modal
      close={close}
      title="Розподілити POS-надходження"
      subtitle="11 травня · monobank · пакет №1842"
    >
      <div className="pos-total">
        <span>Сума надходження</span>
        <strong>{formatMoney(total)}</strong>
        <small>Комісія еквайрингу {formatMoney(fee)}</small>
      </div>
      <div className="split-row">
        <span className="bank-dot teal-dot" />
        <div>
          <strong>Амбулаторія</strong>
          <small>Платні послуги</small>
        </div>
        <input
          type="number"
          value={ambulatory}
          onChange={(e) => setAmbulatory(Number(e.target.value))}
        />
        <b>₴</b>
      </div>
      <div className="split-row">
        <span className="bank-dot blue-dot" />
        <div>
          <strong>Скринінг</strong>
          <small>Медичні скринінги</small>
        </div>
        <input type="number" value={screening} readOnly />
        <b>₴</b>
      </div>
      <div className="commission-row">
        <span>Комісію −936 ₴ розподілити пропорційно</span>
        <label className="switch">
          <input type="checkbox" defaultChecked />
          <span />
        </label>
      </div>
      <div className="split-check">
        <Icon name="check" size={15} /> Розподілено 100% · сума збігається
      </div>
      <div className="modal-actions">
        <button className="secondary" onClick={close}>
          Скасувати
        </button>
        <button className="primary" onClick={done}>
          Зберегти розподіл
        </button>
      </div>
    </Modal>
  )
}

function Modal({
  close,
  title,
  subtitle,
  children,
}: {
  close: () => void
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="modal-wrap">
      <button className="modal-scrim" onClick={close} aria-label="Закрити" />
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button onClick={close}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default App
