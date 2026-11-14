-- ATLAS 4.8.1: nuevos tipos UML que antes NO existían en el catálogo.
-- Conceder únicamente permisos NUEVOS a los roles estándar, sin modificar
-- permisos retirados previamente ni las políticas de roles personalizados.
WITH additions(role_key,kind,action) AS (
 SELECT r.role_key,t.kind,a.action
 FROM (VALUES ('owner'),('admin'),('technical'),('functional'),('viewer')) AS r(role_key)
 CROSS JOIN (VALUES ('uml-subpackage'),('uml-model'),('uml-metaclass'),('uml-subject')) AS t(kind)
 CROSS JOIN (VALUES ('view'),('create'),('edit'),('delete')) AS a(action)
 WHERE (r.role_key IN ('owner','admin','technical'))
    OR (r.role_key='functional' AND t.kind='uml-subject')
    OR (r.role_key='viewer' AND a.action='view')
)
INSERT INTO role_permissions(role_id,permission)
SELECT wr.id, 'element.' || p.action || '.' || p.kind
FROM workspace_roles wr JOIN additions p ON wr.role_key=p.role_key
ON CONFLICT DO NOTHING;
