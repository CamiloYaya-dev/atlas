-- ATLAS: páginas físicas en plantillas de Gestión funcional.
-- Las plantillas anteriores siguen teniendo una página. Los elementos sin 'page' pertenecen a la página 1.
ALTER TABLE functional_templates ADD COLUMN IF NOT EXISTS page_count integer NOT NULL DEFAULT 1
 CHECK(page_count BETWEEN 1 AND 20);
