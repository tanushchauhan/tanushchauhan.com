import { papers } from "#constants/research.js";
import { locations, socials } from "#constants";
import { BUILDS, NEWS, OPENING, TEACHING } from "./content.js";

const EMAIL = "tanush@utexas.edu";

const projectsById = Object.fromEntries(
  (locations.work.children ?? []).map((project) => [project.id, project])
);

/** The authors line, with mine picked out of it. */
const Authors = ({ line, me }) => {
  const at = line.indexOf(me);
  if (at < 0) return <p className="authors">{line}</p>;
  return (
    <p className="authors">
      {line.slice(0, at)}
      <strong>{me}</strong>
      {line.slice(at + me.length)}
    </p>
  );
};

const Paper = ({ paper }) => (
  <article className="entry">
    <div className="figure">
      <img src={paper.image} alt="" loading="lazy" />
    </div>
    <div>
      <h3>{paper.title}</h3>
      <Authors line={paper.authors} me={paper.me} />
      <p className="venue">
        {paper.venue}, {paper.year}
        {paper.status && <span className="tag">{paper.status}</span>}
      </p>
      <p className="summary">{paper.summary}</p>
      {paper.note && <p className="note">{paper.note}</p>}
      {paper.links.length > 0 && (
        <p className="links">
          {paper.links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </p>
      )}
    </div>
  </article>
);

const Build = ({ build }) => {
  const project = projectsById[build.id];
  const about = project?.children?.[0]?.data;
  const links = (project?.children ?? []).filter((child) => child.kind === "link");

  return (
    <article className="entry">
      <div className="figure">{about?.image && <img src={about.image} alt="" loading="lazy" />}</div>
      <div>
        <h3>{build.name ?? project?.name ?? build.id}</h3>
        <p className="venue">{build.note ?? about?.subtitle}</p>
        <p className="summary">{build.line ?? about?.description?.[0]}</p>
        {links.length > 0 && (
          <p className="links">
            {links.map((link) => (
              <a key={link.href} href={link.href}>
                {link.name}
              </a>
            ))}
          </p>
        )}
      </div>
    </article>
  );
};

const Research = () => (
  <>
    <header className="rail">
      <img className="portrait" src="/images/me.jpg" alt="Tanush Chauhan" />
      <h1>Tanush Chauhan</h1>
      <p className="role">{OPENING.role}</p>

      <nav>
        <a href="#research">Research</a>
        <a href="#builds">Builds</a>
        <a href="#news">News</a>
        {TEACHING.length > 0 && <a href="#teaching">Teaching</a>}
        <a href="#contact">Contact</a>
      </nav>

      <p className="links">
        <a href={`mailto:${EMAIL}`}>Email</a>
        {socials.map((social) => (
          <a key={social.id} href={social.link}>
            {social.text}
          </a>
        ))}
        <a href="/cv">CV</a>
      </p>
    </header>

    <main className="column">
      <div className="lede">
        {OPENING.paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      <p className="actions">
        <a href="#research">Research →</a>
        <a href="/cv">CV</a>
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
      </p>

      <section id="research">
        <h2>Research</h2>
        {papers.map((paper) => (
          <Paper key={paper.id} paper={paper} />
        ))}
      </section>

      <section id="builds">
        <h2>Builds</h2>
        {BUILDS.map((build) => (
          <Build key={build.id} build={build} />
        ))}
      </section>

      <section id="news">
        <h2>News</h2>
        <ul className="news">
          {NEWS.map((item) => (
            <li key={item.date + item.text}>
              <time dateTime={item.date}>{item.label}</time>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {TEACHING.length > 0 && (
        <section id="teaching">
          <h2>Teaching and service</h2>
          <ul className="news">
            {TEACHING.map((item) => (
              <li key={item.text}>
                <time>{item.when}</time>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="contact" className="about">
        <h2>Contact</h2>
        <p>
          The fastest way to reach me is <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. I read everything,
          and I answer anything that is not a recruiter template.
        </p>
      </section>

      <footer>
        <p>
          There is also a <a href="/">version of this site that boots like a Mac</a>.
        </p>
      </footer>
    </main>
  </>
);

export default Research;
