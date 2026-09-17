import { useMemo, useState } from 'react';
import { Search, BookOpen, ArrowRight, Check } from 'lucide-react';
import { catalog, books, bookName } from '../data/catalog';
import { type Character, type ContentEntry } from '../domain/model';
import { totalLevel } from '../domain/rules';
import { contentWarnings } from '../domain/progression';
import { Modal, Button, Input, Select, Notice, Pill, SourceLink, CheckBox } from './common';
export function CatalogDialog({
  character,
  initialCategory = '',
  onClose,
  onAdd,
}: {
  character: Character;
  initialCategory?: string;
  onClose: () => void;
  onAdd: (e: ContentEntry, override?: string) => Promise<void>;
}) {
  const [override, setOverride] = useState('');
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState(initialCategory),
    [book, setBook] = useState(''),
    [publisher, setPublisher] = useState(''),
    [classId, setClassId] = useState(''),
    [level, setLevel] = useState(''),
    [onlyEligible, setOnlyEligible] = useState(false),
    [selected, setSelected] = useState<ContentEntry | null>(null),
    [limit, setLimit] = useState(60),
    [error, setError] = useState(''),
    [added, setAdded] = useState('');
  const results = useMemo(
    () =>
      catalog.filter(
        (e) =>
          (!category || e.category === category) &&
          (!book || e.sourceIds.includes(book)) &&
          (!publisher || e.publisher === publisher) &&
          (!classId || e.classIds.includes(classId)) &&
          (level === '' || e.level <= Number(level)) &&
          (!onlyEligible || e.category === 'spell' || e.level <= totalLevel(character)) &&
          [e.name, ...e.sourceIds.map(bookName)]
            .join(' ')
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [query, category, book, publisher, classId, level, onlyEligible, character],
  );
  const choose = async () => {
    if (!selected) return;
    try {
      const warnings = contentWarnings(character, selected);
      if (warnings.length && !override.trim())
        throw new Error(warnings.join(' ') + ' Record an override to continue.');
      await onAdd(selected, override);
      setAdded(selected.id);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal title="Published content library" onClose={onClose} wide>
      <div className="catalog-search">
        <Search size={18} />
        <input
          aria-label="Search published content"
          placeholder="Search spells, features, races, and more…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(60);
          }}
        />
      </div>
      <div className="catalog-filters">
        <Select
          label="Category"
          value={category}
          onChange={(v) => {
            setCategory(v);
            setLimit(60);
          }}
        >
          <option value="">All options</option>
          {['class', 'subclass', 'feature', 'spell', 'race', 'feat', 'background'].map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </Select>
        <Select label="Sourcebook" value={book} onChange={setBook}>
          <option value="">All published books</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select label="Publisher" value={publisher} onChange={setPublisher}>
          <option value="">All publishers</option>
          {[...new Set(catalog.map((e) => e.publisher))].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Select label="Class filter" value={classId} onChange={setClassId}>
          <option value="">All classes</option>
          {[
            'artificer',
            'barbarian',
            'bard',
            'cleric',
            'druid',
            'fighter',
            'monk',
            'paladin',
            'ranger',
            'rogue',
            'sorcerer',
            'warlock',
            'wizard',
          ].map((id) => (
            <option key={id}>{id}</option>
          ))}
        </Select>
        <Input
          label="Maximum level"
          type="number"
          min={0}
          max={20}
          value={level}
          onChange={setLevel}
        />
      </div>
      <CheckBox
        label="Match current character level"
        checked={onlyEligible}
        onChange={setOnlyEligible}
      />
      <div className="catalog-layout">
        <div className="catalog-results">
          <p className="eyebrow">{results.length} published options</p>
          {results.slice(0, limit).map((e) => (
            <button
              className={'catalog-row ' + (selected?.id === e.id ? 'selected' : '')}
              key={e.id}
              onClick={() => {
                setSelected(e);
                setAdded('');
                setOverride('');
                setError('');
              }}
            >
              <span className="catalog-icon">
                <BookOpen size={17} />
              </span>
              <span>
                <strong>{e.name}</strong>
                <small>
                  {e.category} · {e.sourceIds.map(bookName).join(', ')}
                </small>
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
          {results.length > limit && (
            <Button onClick={() => setLimit(limit + 60)}>Show more</Button>
          )}
        </div>
        <div className="catalog-detail">
          {selected ? (
            <>
              <Pill>{selected.category}</Pill>
              <h3>{selected.name}</h3>
              <p className="muted">{selected.sourceIds.map(bookName).join(' · ')}</p>
              <div className="badges">
                <Pill>{selected.publisher}</Pill>
                <Pill>{selected.version}</Pill>
                <Pill tone={selected.automation === 'automated' ? 'success' : 'neutral'}>
                  {selected.automation === 'reference'
                    ? 'Reference & manual effects'
                    : selected.automation === 'partial'
                      ? 'Some effects automated'
                      : 'Sheet effects automated'}
                </Pill>
              </div>
              {selected.mechanics.prerequisites && (
                <Notice tone="warning">
                  Prerequisite: {selected.mechanics.prerequisites}. Check eligibility before adding;
                  your table may override it.
                </Notice>
              )}
              {contentWarnings(character, selected).length > 0 && (
                <>
                  <Notice tone="warning">{contentWarnings(character, selected).join(' ')}</Notice>
                  <Input
                    label="Content prerequisite override reason"
                    value={override}
                    onChange={setOverride}
                  />
                </>
              )}
              {selected.description ? (
                <div className="description">{selected.description}</div>
              ) : (
                <Notice>
                  Use the source reference for the full rules. This entry records your selection;
                  effects marked manual can be configured on your character.
                </Notice>
              )}
              <div className="metadata">
                {Object.entries(selected.metadata)
                  .filter(([k]) => !['parent', 'subclass'].includes(k))
                  .map(([k, v]) => (
                    <div key={k}>
                      <span>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
              </div>
              {selected.mechanics.choice && <Notice>{selected.mechanics.choice}</Notice>}
              <SourceLink url={selected.url}>View source reference</SourceLink>
              <div className="dialog-actions">
                {selected.category === 'class' ? (
                  <p className="muted">Use the Level up action to add or advance this class.</p>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => void choose()}
                    disabled={added === selected.id || !!character.selections[selected.id]?.active}
                  >
                    {added === selected.id || character.selections[selected.id]?.active ? (
                      <>
                        <Check size={16} /> On your sheet
                      </>
                    ) : (
                      <>
                        Add to character <ArrowRight size={16} />
                      </>
                    )}
                  </Button>
                )}
              </div>
              {error && <Notice tone="error">{error}</Notice>}
            </>
          ) : (
            <div className="empty">
              <BookOpen size={32} />
              <h3>Find your next possibility</h3>
              <p>
                Choose an option to see its source, version, and supported effects. Only verified
                published books are included.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
