-- Tipos de nodos UML 2.5.1 de actividades, permisos para roles estándar.
-- No reintroduce privilegios retirados sobre otros elementos.
WITH additions(role_key,kind,action) AS (
 SELECT r.role_key,t.kind,a.action
 FROM (VALUES ('owner'),('admin'),('technical'),('functional'),('viewer')) AS r(role_key)
 CROSS JOIN (VALUES ('uml-flow-final'),('uml-object-node'),('uml-partition')) AS t(kind)
 CROSS JOIN (VALUES ('view'),('create'),('edit'),('delete')) AS a(action)
 WHERE r.role_key IN ('owner','admin','technical','functional')
    OR (r.role_key='viewer' AND a.action='view')
)
INSERT INTO role_permissions(role_id,permission)
SELECT wr.id, 'element.' || p.action || '.' || p.kind
FROM workspace_roles wr JOIN additions p ON wr.role_key=p.role_key
ON CONFLICT DO NOTHING;
