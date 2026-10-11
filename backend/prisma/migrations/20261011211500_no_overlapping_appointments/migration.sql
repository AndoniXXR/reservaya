-- Protección contra reservas dobles a nivel de base de datos.
-- Un profesional no puede tener dos citas activas (CONFIRMED o COMPLETED) cuyos
-- intervalos [startsAt, endsAt) se traslapen, ni siquiera con peticiones simultáneas.
-- Si se viola, PostgreSQL devuelve el código 23P01 (exclusion_violation).

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
ADD CONSTRAINT no_overlapping_appointments
EXCLUDE USING gist (
  "staffId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
) WHERE (status IN ('CONFIRMED', 'COMPLETED'));
