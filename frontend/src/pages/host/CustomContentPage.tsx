import { useEffect, useState } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  createCustomEntity,
  deleteCustomEntity,
  listCustomEntities,
  updateCustomEntity,
  SEGMENT_FIELDS,
  SEGMENT_LABELS,
  SEGMENT_SINGULAR_LABELS,
  type CustomContentSegment,
  type CustomEntity,
  type CustomFieldConfig,
} from '../../api/customContent';

const SEGMENTS = Object.keys(SEGMENT_LABELS) as CustomContentSegment[];

const inputClass =
  'w-full rounded-md border border-admin-border bg-admin-card px-3 py-2 text-sm text-admin-heading focus:border-admin-accent focus:outline-none dark:border-admin-border-dark dark:bg-admin-bg-dark dark:text-admin-heading-dark';

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

function fieldInputValue(field: CustomFieldConfig, value: unknown): string | number {
  if (value === undefined || value === null) {
    return field.type === 'number' ? '' : (field.defaultValue ?? '');
  }
  return value as string | number;
}

function readForm(fields: CustomFieldConfig[], form: FormData): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === 'boolean') {
      body[field.name] = form.get(field.name) === 'on';
    } else if (field.type === 'number') {
      const raw = String(form.get(field.name) ?? '').trim();
      body[field.name] = raw === '' ? undefined : Number(raw);
    } else {
      const raw = String(form.get(field.name) ?? '').trim();
      body[field.name] = raw === '' ? (field.defaultValue ?? undefined) : raw;
    }
  }
  return body;
}

function EntityFields({
  fields,
  entity,
}: {
  fields: CustomFieldConfig[];
  entity?: CustomEntity;
}) {
  return (
    <>
      {fields.map((field) => {
        const value = entity ? fieldInputValue(field, entity[field.name]) : undefined;
        if (field.type === 'boolean') {
          return (
            <label key={field.name} className="flex items-center gap-2 text-sm text-admin-heading dark:text-admin-heading-dark">
              <input
                type="checkbox"
                name={field.name}
                defaultChecked={Boolean(entity?.[field.name])}
              />
              {field.label}
            </label>
          );
        }
        if (field.type === 'textarea') {
          return (
            <textarea
              key={field.name}
              name={field.name}
              placeholder={field.label}
              required={field.required}
              defaultValue={(value as string) ?? field.defaultValue ?? ''}
              className={inputClass}
            />
          );
        }
        return (
          <input
            key={field.name}
            name={field.name}
            type={field.type === 'number' ? 'number' : 'text'}
            placeholder={field.label}
            required={field.required}
            defaultValue={value ?? ''}
            className={inputClass}
          />
        );
      })}
    </>
  );
}

function SegmentPanel({ segment }: { segment: CustomContentSegment }) {
  const fields = SEGMENT_FIELDS[segment];
  const [entities, setEntities] = useState<CustomEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    listCustomEntities(segment)
      .then(setEntities)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [segment]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    setError(null);
    try {
      await createCustomEntity(segment, readForm(fields, new FormData(formEl)));
      formEl.reset();
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const handleUpdate = async (id: number, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await updateCustomEntity(segment, id, readForm(fields, new FormData(e.currentTarget)));
      setEditingId(null);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await deleteCustomEntity(segment, id);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <div aria-label={SEGMENT_LABELS[segment]}>
      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="mb-6 flex max-w-md flex-col gap-2 rounded-md border border-admin-border bg-admin-card p-4 dark:border-admin-border-dark dark:bg-admin-card-dark"
      >
        <h2 className="mb-1 text-sm font-semibold text-admin-heading dark:text-admin-heading-dark">
          Add {SEGMENT_SINGULAR_LABELS[segment]}
        </h2>
        <EntityFields fields={fields} />
        <button
          type="submit"
          className="self-start rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Create
        </button>
      </form>

      {loading ? (
        <p className="text-admin-subtext dark:text-admin-subtext-dark">Loading…</p>
      ) : entities.length === 0 ? (
        <p className="text-admin-subtext dark:text-admin-subtext-dark">
          No custom {SEGMENT_LABELS[segment].toLowerCase()} yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entities.map((entity) => (
            <li
              key={entity.id}
              className="rounded-md border border-admin-border bg-admin-card p-4 dark:border-admin-border-dark dark:bg-admin-card-dark"
            >
              {editingId === entity.id ? (
                <form onSubmit={(e) => void handleUpdate(entity.id, e)} className="flex flex-col gap-2">
                  <EntityFields fields={fields} entity={entity} />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-md bg-admin-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md px-3 py-2 text-sm text-admin-subtext hover:text-admin-heading dark:text-admin-subtext-dark dark:hover:text-admin-heading-dark"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <h3 className="font-medium text-admin-heading dark:text-admin-heading-dark">
                    {entity.name}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(entity.id)}
                      className="rounded-md border border-admin-border px-3 py-1.5 text-xs text-admin-heading hover:bg-admin-divider dark:border-admin-border-dark dark:text-admin-heading-dark dark:hover:bg-admin-divider-dark"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(entity.id)}
                      className="rounded-md border border-admin-border px-3 py-1.5 text-xs text-admin-heading hover:bg-admin-divider dark:border-admin-border-dark dark:text-admin-heading-dark dark:hover:bg-admin-divider-dark"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const segmentTabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-admin-accent text-white'
      : 'text-admin-subtext hover:bg-admin-divider hover:text-admin-heading dark:text-admin-subtext-dark dark:hover:bg-admin-divider-dark dark:hover:text-admin-heading-dark'
  }`;

export default function CustomContentPage() {
  const { segment } = useParams<{ segment?: string }>();

  if (!segment) {
    return <Navigate to={SEGMENTS[0]} replace />;
  }
  if (!SEGMENTS.includes(segment as CustomContentSegment)) {
    return <Navigate to={SEGMENTS[0]} replace />;
  }

  return (
    <div aria-label="Custom Content">
      <p className="mb-4 text-sm text-admin-subtext dark:text-admin-subtext-dark">
        GM-authored classes, ancestries, communities, domains, domain cards, weapons, and armor,
        alongside the SRD&apos;s static datasets.
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <NavLink key={s} to={`/host/custom-content/${s}`} className={segmentTabClass}>
            {SEGMENT_LABELS[s]}
          </NavLink>
        ))}
      </div>
      <SegmentPanel segment={segment as CustomContentSegment} />
    </div>
  );
}
