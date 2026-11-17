-- CreateEnum
CREATE TYPE "tipo_flujo" AS ENUM ('bancario', 'dinamico');

-- CreateTable
CREATE TABLE "empresas" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "identificacion" VARCHAR(20),
    "status_id" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "descripcion" VARCHAR(50) NOT NULL,
    "detalle" VARCHAR(500),
    "fecha_inicio" DATE NOT NULL,
    "meta" INTEGER,
    "tipo_flujo" "tipo_flujo" NOT NULL DEFAULT 'dinamico',
    "status_id" INTEGER NOT NULL DEFAULT 2,
    "codigo" VARCHAR(10) NOT NULL DEFAULT '',
    "campo_2" VARCHAR(10),
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usertypes" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usertypes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "apellido" VARCHAR(50) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "usertype_id" INTEGER NOT NULL,
    "status_id" INTEGER NOT NULL,
    "servicio_id" INTEGER NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_servicios" (
    "user_id" INTEGER NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_servicios_pkey" PRIMARY KEY ("user_id","servicio_id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "identificacion" TEXT,
    "nombre_legal" TEXT,
    "telf_hab" TEXT,
    "telf_ofi" TEXT,
    "telf_cel" TEXT,
    "correo" TEXT,
    "direccion" TEXT,
    "cuenta" TEXT,
    "oferta" TEXT NOT NULL DEFAULT '',
    "status_id" INTEGER DEFAULT 3,
    "servicio_id" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestion" (
    "id" SERIAL NOT NULL,
    "contacto_id" INTEGER,
    "efectivo_id" INTEGER,
    "producto_id" INTEGER,
    "noefectivo_id" INTEGER,
    "subcontacto_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "status_id" INTEGER NOT NULL,
    "hora" TIME(0) NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "tipo_gestion" VARCHAR(30) NOT NULL DEFAULT 'telefonica',
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "efectivo" (
    "id" SERIAL NOT NULL,
    "descripcion" VARCHAR(50) NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "efectivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "noefectivo" (
    "id" SERIAL NOT NULL,
    "descripcion" VARCHAR(50) NOT NULL,
    "servicio_id" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "noefectivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontacto" (
    "id" SERIAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "efectivo_id" INTEGER,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcontacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "descripcion" VARCHAR(100),
    "codigo_producto" VARCHAR(11),
    "costo_prod" VARCHAR(11),
    "status_id" INTEGER NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "fecha" VARCHAR(20) NOT NULL,
    "codplan" VARCHAR(10) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados" (
    "id" SERIAL NOT NULL,
    "gestion_id" INTEGER NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "apellido" VARCHAR(60) NOT NULL,
    "genero" VARCHAR(1) NOT NULL,
    "fecha_nacimiento" DATE,
    "nacionalidad" VARCHAR(2) NOT NULL,
    "cedula" VARCHAR(10) NOT NULL,
    "telf_hab" VARCHAR(20) NOT NULL,
    "telf_ofi" VARCHAR(20),
    "telf_celular" VARCHAR(20) NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "estado_id" INTEGER NOT NULL,
    "ciudad_id" INTEGER NOT NULL,
    "municipio_id" INTEGER NOT NULL,
    "cuenta" VARCHAR(20) NOT NULL,
    "tipo_cuenta_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "observaciones" VARCHAR(250) NOT NULL DEFAULT '',
    "fecha_venta" DATE NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "status_id" INTEGER DEFAULT 7,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estado" (
    "id" SERIAL NOT NULL,
    "estado" VARCHAR(50) NOT NULL,
    "codigo" INTEGER NOT NULL,
    "servicio_id" INTEGER NOT NULL,

    CONSTRAINT "estado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ciudad" (
    "id" SERIAL NOT NULL,
    "ciudad" VARCHAR(80) NOT NULL,
    "codigo" VARCHAR(3) NOT NULL,
    "estado_id" INTEGER NOT NULL,
    "servicio_id" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ciudad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "municipio" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "codigo" VARCHAR(4) NOT NULL,
    "estado_id" INTEGER NOT NULL,
    "servicio_id" INTEGER NOT NULL,

    CONSTRAINT "municipio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_cuentas" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50),
    "codigo" INTEGER,
    "status_id" INTEGER NOT NULL,

    CONSTRAINT "tipo_cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones" (
    "id_transaccion" SERIAL NOT NULL,
    "fecha" VARCHAR(15) NOT NULL,
    "resultado_id" INTEGER NOT NULL,

    CONSTRAINT "transacciones_pkey" PRIMARY KEY ("id_transaccion")
);

-- CreateTable
CREATE TABLE "formularios" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "status_id" INTEGER NOT NULL DEFAULT 1,
    "btn_texto" VARCHAR(80) NOT NULL DEFAULT 'Guardar',
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "eliminado_en" TIMESTAMPTZ(0),
    "user_id" INTEGER,
    "fecha" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formularios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulario_versiones" (
    "id" SERIAL NOT NULL,
    "formulario_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "definicion" JSONB NOT NULL,
    "nota" VARCHAR(255),
    "vigente" BOOLEAN NOT NULL DEFAULT false,
    "user_id" INTEGER,
    "fecha" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formulario_versiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulario_servicios" (
    "id" SERIAL NOT NULL,
    "formulario_id" INTEGER NOT NULL,
    "servicio_id" INTEGER NOT NULL,

    CONSTRAINT "formulario_servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulario_cargas" (
    "id" SERIAL NOT NULL,
    "formulario_id" INTEGER NOT NULL,
    "archivo" VARCHAR(255) NOT NULL,
    "filas" INTEGER NOT NULL DEFAULT 0,
    "mapping" JSONB NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT false,
    "user_id" INTEGER,
    "fecha" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formulario_cargas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulario_carga_filas" (
    "id" BIGSERIAL NOT NULL,
    "carga_id" INTEGER NOT NULL,
    "clave" VARCHAR(191),
    "fila" JSONB NOT NULL,

    CONSTRAINT "formulario_carga_filas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulario_envios" (
    "id" SERIAL NOT NULL,
    "formulario_id" INTEGER NOT NULL,
    "version_id" INTEGER NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "carga_id" INTEGER,
    "fila_id" BIGINT,
    "registro" JSONB,
    "valores" JSONB NOT NULL,
    "user_id" INTEGER,
    "fecha" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formulario_envios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulario_expresiones" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "patron" VARCHAR(255),
    "transformacion" VARCHAR(20),
    "tipos" VARCHAR(60) NOT NULL DEFAULT 'text,textarea',
    "ejemplo_valido" VARCHAR(120) NOT NULL,
    "ejemplo_invalido" VARCHAR(120),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "status_id" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "formulario_expresiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_empresa_nombre" ON "empresas"("nombre");

-- CreateIndex
CREATE INDEX "idx_servicio_empresa" ON "servicios"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_servicio_empresa_nombre" ON "servicios"("empresa_id", "descripcion");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_username" ON "users"("username");

-- CreateIndex
CREATE INDEX "idx_users_usertype" ON "users"("usertype_id");

-- CreateIndex
CREATE INDEX "idx_users_status" ON "users"("status_id");

-- CreateIndex
CREATE INDEX "idx_users_servicio" ON "users"("servicio_id");

-- CreateIndex
CREATE INDEX "idx_us_servicio" ON "usuario_servicios"("servicio_id");

-- CreateIndex
CREATE INDEX "idx_clientes_status_id" ON "clientes"("status_id");

-- CreateIndex
CREATE INDEX "idx_clientes_servicio_status" ON "clientes"("servicio_id", "status_id");

-- CreateIndex
CREATE INDEX "idx_clientes_servicio_identificacion" ON "clientes"("servicio_id", "identificacion");

-- CreateIndex
CREATE INDEX "idx_gestion_cliente_id" ON "gestion"("cliente_id");

-- CreateIndex
CREATE INDEX "idx_gestion_user_id" ON "gestion"("user_id");

-- CreateIndex
CREATE INDEX "idx_gestion_status_id" ON "gestion"("status_id");

-- CreateIndex
CREATE INDEX "idx_gestion_servicio_fecha" ON "gestion"("servicio_id", "fecha");

-- CreateIndex
CREATE INDEX "idx_gestion_efectivo_id" ON "gestion"("efectivo_id");

-- CreateIndex
CREATE INDEX "idx_gestion_noefectivo_id" ON "gestion"("noefectivo_id");

-- CreateIndex
CREATE INDEX "idx_gestion_fecha" ON "gestion"("fecha");

-- CreateIndex
CREATE INDEX "idx_gestion_cliente_user" ON "gestion"("cliente_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_efectivo_servicio" ON "efectivo"("servicio_id");

-- CreateIndex
CREATE INDEX "idx_subcontacto_efectivo" ON "subcontacto"("efectivo_id");

-- CreateIndex
CREATE INDEX "idx_productos_servicio_status" ON "productos"("servicio_id", "status_id");

-- CreateIndex
CREATE INDEX "idx_resultados_estado_id" ON "resultados"("estado_id");

-- CreateIndex
CREATE INDEX "idx_resultados_ciudad_id" ON "resultados"("ciudad_id");

-- CreateIndex
CREATE INDEX "idx_resultados_producto_id" ON "resultados"("producto_id");

-- CreateIndex
CREATE INDEX "idx_resultados_gestion_id" ON "resultados"("gestion_id");

-- CreateIndex
CREATE INDEX "idx_resultados_cedula" ON "resultados"("cedula");

-- CreateIndex
CREATE INDEX "idx_resultados_servicio_fecha" ON "resultados"("servicio_id", "fecha_venta");

-- CreateIndex
CREATE INDEX "idx_ciudad_estado" ON "ciudad"("estado_id");

-- CreateIndex
CREATE INDEX "idx_municipio_estado" ON "municipio"("estado_id");

-- CreateIndex
CREATE INDEX "idx_formularios_estado" ON "formularios"("status_id", "eliminado");

-- CreateIndex
CREATE INDEX "idx_ver_vigente" ON "formulario_versiones"("formulario_id", "vigente");

-- CreateIndex
CREATE UNIQUE INDEX "uq_form_version" ON "formulario_versiones"("formulario_id", "version");

-- CreateIndex
CREATE INDEX "idx_fs_servicio" ON "formulario_servicios"("servicio_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_form_serv" ON "formulario_servicios"("formulario_id", "servicio_id");

-- CreateIndex
CREATE INDEX "idx_carga_vigente" ON "formulario_cargas"("formulario_id", "vigente");

-- CreateIndex
CREATE INDEX "idx_carga_clave" ON "formulario_carga_filas"("carga_id", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "uq_env_fila" ON "formulario_envios"("fila_id");

-- CreateIndex
CREATE INDEX "idx_env_servicio" ON "formulario_envios"("servicio_id", "fecha");

-- CreateIndex
CREATE INDEX "idx_env_form" ON "formulario_envios"("formulario_id", "fecha");

-- CreateIndex
CREATE INDEX "idx_env_version" ON "formulario_envios"("version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_expr_clave" ON "formulario_expresiones"("clave");

-- AddForeignKey
ALTER TABLE "servicios" ADD CONSTRAINT "fk_servicio_empresa" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "fk_users_usertype" FOREIGN KEY ("usertype_id") REFERENCES "usertypes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "fk_users_status" FOREIGN KEY ("status_id") REFERENCES "status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "fk_users_servicio" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_servicios" ADD CONSTRAINT "fk_us_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_servicios" ADD CONSTRAINT "fk_us_servicio" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "efectivo" ADD CONSTRAINT "fk_efectivo_servicio" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulario_versiones" ADD CONSTRAINT "fk_ver_form" FOREIGN KEY ("formulario_id") REFERENCES "formularios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulario_servicios" ADD CONSTRAINT "fk_fs_form" FOREIGN KEY ("formulario_id") REFERENCES "formularios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulario_cargas" ADD CONSTRAINT "fk_carga_form" FOREIGN KEY ("formulario_id") REFERENCES "formularios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulario_carga_filas" ADD CONSTRAINT "fk_filas_carga" FOREIGN KEY ("carga_id") REFERENCES "formulario_cargas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulario_envios" ADD CONSTRAINT "fk_env_form" FOREIGN KEY ("formulario_id") REFERENCES "formularios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulario_envios" ADD CONSTRAINT "fk_env_version" FOREIGN KEY ("version_id") REFERENCES "formulario_versiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulario_envios" ADD CONSTRAINT "fk_env_carga" FOREIGN KEY ("carga_id") REFERENCES "formulario_cargas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulario_envios" ADD CONSTRAINT "fk_env_fila" FOREIGN KEY ("fila_id") REFERENCES "formulario_carga_filas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
