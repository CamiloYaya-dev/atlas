-- ATLAS v4.8.1: documento funcional vinculado a plantilla + campos dinámicos de formulario.
-- La migración es aditiva y no sustituye registros ni diseños previos.
ALTER TABLE functional_items ADD COLUMN IF NOT EXISTS template_id uuid NULL;
ALTER TABLE functional_items DROP CONSTRAINT IF EXISTS functional_items_template_id_fkey;
ALTER TABLE functional_items ADD CONSTRAINT functional_items_template_id_fkey
 FOREIGN KEY(template_id) REFERENCES functional_templates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_functional_items_template ON functional_items(project_id,template_id);
ALTER TABLE functional_fields DROP CONSTRAINT IF EXISTS functional_fields_field_type_check;
ALTER TABLE functional_fields ADD CONSTRAINT functional_fields_field_type_check CHECK(field_type IN
 ('text','long','number','currency','date','time','datetime','boolean','select','multi_select','checkbox_group','list','table','image','url','email'));
-- Los campos de formulario están disponibles siempre; los creados desde la hoja
-- se muestran solo al elegir una plantilla que los use.
ALTER TABLE functional_fields ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global'
 CHECK(scope IN ('global','template'));
-- Compatibilidad retroactiva: los componentes de captura creados en el diseñador
-- anterior no tenían campo de formulario. Se crean en su mismo proyecto y tipo.
-- Logo, texto fijo y líneas siguen siendo elementos decorativos.
DO $$
DECLARE t RECORD; e jsonb; updated_layout jsonb; at_index integer; n text; ftype text; fresh_id uuid; changed boolean;
BEGIN
 FOR t IN SELECT id,project_id,kind,layout FROM functional_templates LOOP
  updated_layout := t.layout; at_index := 0; changed := false;
  FOR e IN SELECT value FROM jsonb_array_elements(t.layout) LOOP
   ftype := CASE
     WHEN e->>'kind'='table' THEN 'table'
     WHEN e->>'kind'='list' THEN 'list'
     WHEN e->>'kind'='checkbox' THEN 'boolean'
     WHEN e->>'kind'='image' AND e->>'id'<>'logo' AND COALESCE(e->>'image','')='' THEN 'image'
     WHEN e->>'kind'='text' AND e->>'text'='Nuevo texto' THEN 'long'
     ELSE NULL END;
   IF ftype IS NOT NULL AND COALESCE(e->>'field','')='' THEN
    fresh_id := gen_random_uuid();
    n := left(COALESCE(NULLIF(trim(e->>'name'),''),
      CASE ftype WHEN 'table' THEN 'Tabla' WHEN 'list' THEN 'Lista' WHEN 'boolean' THEN 'Casilla' WHEN 'image' THEN 'Imagen' ELSE 'Texto' END),78)
      || ' · ' || left(fresh_id::text,8);
    INSERT INTO functional_fields(id,project_id,kind,name,field_type,required,options,scope)
      VALUES(fresh_id,t.project_id,t.kind,n,ftype,false,'[]'::jsonb,'template');
    e := e || jsonb_build_object('field','custom:'||fresh_id::text,'name',n);
    updated_layout := jsonb_set(updated_layout,ARRAY[at_index::text],e);
    changed := true;
   END IF;
   at_index := at_index+1;
  END LOOP;
  IF changed THEN UPDATE functional_templates SET layout=updated_layout,version=version+1,updated_at=now() WHERE id=t.id;END IF;
 END LOOP;
END $$;
