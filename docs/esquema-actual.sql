-- Esquema actual de BulkApp (MySQL/MariaDB) exportado el 2026-11-03 con SHOW CREATE TABLE.
-- Solo lectura. Filas = conteo al momento de exportar (no es dato de diseño).
-- Tablas legacy/vacías marcadas en docs/migracion/*.md.

-- TABLA carga_temporal_clientes (filas: 0)
CREATE TABLE `carga_temporal_clientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `identificacion` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci DEFAULT NULL,
  `nombre_legal` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci DEFAULT NULL,
  `telf_hab` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci DEFAULT NULL,
  `telf_ofi` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci DEFAULT NULL,
  `telf_cel` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci DEFAULT NULL,
  `correo` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci DEFAULT NULL,
  `direccion` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci DEFAULT NULL,
  `cuenta` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci DEFAULT NULL,
  `oferta` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci DEFAULT NULL,
  `servicio_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci

-- TABLA carga_temportal_cashea (filas: 0)
CREATE TABLE `carga_temportal_cashea` (
  `id` int(11) NOT NULL DEFAULT 0,
  `cedula` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `id_cuota` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `nombre_grupo` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `fecha_pagar` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `monto_cuota` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `numero_cuota` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `fee` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `plata_por_cobrar` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `capital_asignado` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `id_orden` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `identificacion_orden` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `fecha_creacion_orden` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `email` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `telefono` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `nombre_usuario` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `local_origen` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `estado_deuda` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `tramo_inicial` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `tramo_actual` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `segmento` text CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish2_ci DEFAULT NULL,
  `status_id` int(11) DEFAULT 3,
  `servicio_id` int(11) DEFAULT 2,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci

-- TABLA cashea_customers (filas: 0)
CREATE TABLE `cashea_customers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cedula` varchar(20) DEFAULT NULL,
  `id_cuota` varchar(20) DEFAULT NULL,
  `nombre_grupo` text DEFAULT NULL,
  `fecha_pagar` text DEFAULT NULL,
  `monto_cuota` text DEFAULT NULL,
  `numero_cuota` text DEFAULT NULL,
  `fee` text DEFAULT NULL,
  `plata_por_cobrar` text DEFAULT NULL,
  `capital_asignado` text DEFAULT NULL,
  `id_orden` text DEFAULT NULL,
  `identificacion_orden` text DEFAULT NULL,
  `fecha_creacion_orden` text DEFAULT NULL,
  `email` text DEFAULT NULL,
  `telefono` text DEFAULT NULL,
  `nombre_usuario` text DEFAULT NULL,
  `local_origen` text DEFAULT NULL,
  `estado_deuda` text DEFAULT NULL,
  `tramo_inicial` text DEFAULT NULL,
  `tramo_actual` text DEFAULT NULL,
  `segmento` text DEFAULT NULL,
  `status_id` int(11) DEFAULT 3,
  `servicio_id` int(11) DEFAULT 2,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_cashea_customers_cedula` (`cedula`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci

-- TABLA ciudad (filas: 1007)
CREATE TABLE `ciudad` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ciudad` varchar(80) NOT NULL,
  `codigo` varchar(3) NOT NULL,
  `estado_id` int(11) NOT NULL,
  `servicio_id` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `id_ciudad` (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=1008 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA clientes (filas: 125741)
CREATE TABLE `clientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `identificacion` text DEFAULT NULL,
  `nombre_legal` text DEFAULT NULL,
  `telf_hab` text DEFAULT NULL,
  `telf_ofi` text DEFAULT NULL,
  `telf_cel` text DEFAULT NULL,
  `correo` text DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `cuenta` text DEFAULT NULL,
  `oferta` text NOT NULL,
  `status_id` int(11) DEFAULT 3,
  `servicio_id` int(11) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `id_cliente` (`id`) USING BTREE,
  KEY `idx_clientes_status_id` (`status_id`),
  KEY `idx_clientes_servicio_id` (`servicio_id`),
  KEY `idx_clientes_servicio_status` (`servicio_id`,`status_id`)
) ENGINE=InnoDB AUTO_INCREMENT=157742 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA efectivo (filas: 13)
CREATE TABLE `efectivo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `descripcion` varchar(50) NOT NULL,
  `servicio_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  KEY `id_efectivo` (`id`) USING BTREE,
  KEY `servicioid` (`servicio_id`) USING BTREE,
  CONSTRAINT `servicioid` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA empresas (filas: 4)
CREATE TABLE `empresas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `identificacion` varchar(20) DEFAULT NULL,
  `status_id` int(11) NOT NULL DEFAULT 2,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_empresa_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci

-- TABLA estado (filas: 24)
CREATE TABLE `estado` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `estado` varchar(50) NOT NULL,
  `codigo` int(11) NOT NULL,
  `servicio_id` int(11) NOT NULL,
  KEY `id_estado` (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=132 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA formulario_carga_filas (filas: 19824)
CREATE TABLE `formulario_carga_filas` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `carga_id` int(10) unsigned NOT NULL,
  `clave` varchar(191) DEFAULT NULL,
  `fila` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`fila`)),
  PRIMARY KEY (`id`),
  KEY `idx_carga` (`carga_id`),
  KEY `idx_carga_clave` (`carga_id`,`clave`),
  CONSTRAINT `fk_filas_carga` FOREIGN KEY (`carga_id`) REFERENCES `formulario_cargas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19830 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci

-- TABLA formulario_cargas (filas: 2)
CREATE TABLE `formulario_cargas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `formulario_id` int(10) unsigned NOT NULL,
  `archivo` varchar(255) NOT NULL,
  `filas` int(11) NOT NULL DEFAULT 0,
  `mapping` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`mapping`)),
  `vigente` tinyint(1) NOT NULL DEFAULT 0,
  `user_id` int(11) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_carga_vigente` (`formulario_id`,`vigente`),
  CONSTRAINT `fk_carga_form` FOREIGN KEY (`formulario_id`) REFERENCES `formularios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci

-- TABLA formulario_envios (filas: 2)
CREATE TABLE `formulario_envios` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `formulario_id` int(10) unsigned NOT NULL,
  `version_id` int(10) unsigned NOT NULL,
  `servicio_id` int(11) NOT NULL,
  `carga_id` int(10) unsigned DEFAULT NULL,
  `fila_id` bigint(20) unsigned DEFAULT NULL,
  `registro` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`registro`)),
  `valores` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`valores`)),
  `user_id` int(11) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_env_fila` (`fila_id`),
  KEY `idx_env_servicio` (`servicio_id`,`fecha`),
  KEY `idx_env_form` (`formulario_id`,`fecha`),
  KEY `idx_env_version` (`version_id`),
  KEY `fk_env_carga` (`carga_id`),
  CONSTRAINT `fk_env_carga` FOREIGN KEY (`carga_id`) REFERENCES `formulario_cargas` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_env_fila` FOREIGN KEY (`fila_id`) REFERENCES `formulario_carga_filas` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_env_form` FOREIGN KEY (`formulario_id`) REFERENCES `formularios` (`id`),
  CONSTRAINT `fk_env_version` FOREIGN KEY (`version_id`) REFERENCES `formulario_versiones` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci

-- TABLA formulario_servicios (filas: 2)
CREATE TABLE `formulario_servicios` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `formulario_id` int(10) unsigned NOT NULL,
  `servicio_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_form_serv` (`formulario_id`,`servicio_id`),
  KEY `idx_servicio` (`servicio_id`),
  CONSTRAINT `fk_fs_form` FOREIGN KEY (`formulario_id`) REFERENCES `formularios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci

-- TABLA formulario_versiones (filas: 14)
CREATE TABLE `formulario_versiones` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `formulario_id` int(10) unsigned NOT NULL,
  `version` int(11) NOT NULL,
  `definicion` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`definicion`)),
  `nota` varchar(255) DEFAULT NULL,
  `vigente` tinyint(1) NOT NULL DEFAULT 0,
  `user_id` int(11) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_form_version` (`formulario_id`,`version`),
  KEY `idx_vigente` (`formulario_id`,`vigente`),
  CONSTRAINT `fk_ver_form` FOREIGN KEY (`formulario_id`) REFERENCES `formularios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci

-- TABLA formularios (filas: 3)
CREATE TABLE `formularios` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `status_id` int(11) NOT NULL DEFAULT 1,
  `btn_texto` varchar(80) NOT NULL DEFAULT 'Guardar',
  `eliminado` tinyint(1) NOT NULL DEFAULT 0,
  `eliminado_en` datetime DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `actualizado` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_estado` (`status_id`,`eliminado`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci

-- TABLA gestion (filas: 61124)
CREATE TABLE `gestion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `contacto_id` int(11) DEFAULT NULL,
  `efectivo_id` int(11) DEFAULT NULL,
  `producto_id` int(11) DEFAULT NULL,
  `noefectivo_id` int(11) DEFAULT NULL,
  `subContacto_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `fecha` date NOT NULL,
  `cliente_id` int(11) NOT NULL,
  `status_id` int(11) NOT NULL,
  `hora` time NOT NULL,
  `servicio_id` varchar(10) NOT NULL,
  `tipoGestion` varchar(30) NOT NULL DEFAULT 'telefonica',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_gestion_cliente_id` (`cliente_id`),
  KEY `idx_gestion_user_id` (`user_id`),
  KEY `idx_gestion_status_id` (`status_id`),
  KEY `idx_gestion_servicio_id` (`servicio_id`),
  KEY `idx_gestion_efectivo_id` (`efectivo_id`),
  KEY `idx_gestion_noefectivo_id` (`noefectivo_id`),
  KEY `idx_gestion_subContacto_id` (`subContacto_id`),
  KEY `idx_gestion_fecha` (`fecha`),
  KEY `idx_gestion_cliente_user` (`cliente_id`,`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=61125 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA municipio (filas: 338)
CREATE TABLE `municipio` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `codigo` varchar(4) NOT NULL,
  `estado_id` int(11) NOT NULL,
  `servicio_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `id_municipio` (`id`) USING BTREE,
  KEY `id_ciudad` (`estado_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=339 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA noefectivo (filas: 17)
CREATE TABLE `noefectivo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `descripcion` varchar(50) NOT NULL,
  `servicio_id` int(11) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  KEY `id_noefectivo` (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA productos (filas: 9)
CREATE TABLE `productos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `descripcion` varchar(100) DEFAULT NULL,
  `codigo_producto` varchar(11) DEFAULT NULL,
  `costo_prod` varchar(11) DEFAULT NULL,
  `status_id` int(11) NOT NULL,
  `servicio_id` int(11) NOT NULL,
  `fecha` varchar(20) NOT NULL,
  `codplan` varchar(10) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `id_producto` (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA rechazo_ventas (filas: 0)
CREATE TABLE `rechazo_ventas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `motivo` varchar(15) NOT NULL,
  `fecha` varchar(11) NOT NULL,
  `resultado_id` int(11) NOT NULL,
  `servicio_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA resultados (filas: 2912)
CREATE TABLE `resultados` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `gestion_id` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `apellido` varchar(50) NOT NULL,
  `genero` varchar(1) NOT NULL,
  `fecha_nacimiento` varchar(11) NOT NULL,
  `nacionalidad` varchar(2) NOT NULL,
  `cedula` int(11) NOT NULL,
  `telf_hab` varchar(15) NOT NULL,
  `telf_ofi` varchar(15) DEFAULT NULL,
  `telf_celular` varchar(15) NOT NULL,
  `correo` varchar(100) NOT NULL,
  `estado_id` int(11) NOT NULL,
  `ciudad_id` int(11) NOT NULL,
  `municipio_id` int(11) NOT NULL,
  `cuenta` varchar(20) NOT NULL,
  `tipo_cuenta_id` int(11) NOT NULL,
  `producto_id` int(11) NOT NULL,
  `observaciones` varchar(250) NOT NULL,
  `fecha_venta` varchar(10) NOT NULL,
  `servicio_id` int(11) NOT NULL,
  `status_id` int(11) DEFAULT 7,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `id_resultado` (`id`) USING BTREE,
  KEY `idx_resultados_estado_id` (`estado_id`),
  KEY `idx_resultados_ciudad_id` (`ciudad_id`),
  KEY `idx_resultados_municipio_id` (`municipio_id`),
  KEY `idx_resultados_producto_id` (`producto_id`),
  KEY `idx_resultados_tipo_cuenta_id` (`tipo_cuenta_id`),
  KEY `idx_resultados_status_id` (`status_id`),
  KEY `idx_resultados_servicio_id` (`servicio_id`),
  KEY `idx_resultados_gestion_id` (`gestion_id`),
  KEY `idx_resultados_cedula` (`cedula`),
  KEY `idx_resultados_fecha_venta` (`fecha_venta`)
) ENGINE=InnoDB AUTO_INCREMENT=2920 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA results_cashea (filas: 0)
CREATE TABLE `results_cashea` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `gestion_id` int(11) DEFAULT NULL,
  `paymentPlan` varchar(20) DEFAULT NULL,
  `paymentDate` varchar(11) DEFAULT NULL,
  `idQuote` varchar(50) DEFAULT NULL,
  `amount` varchar(11) DEFAULT NULL,
  `fullName` text DEFAULT NULL,
  `relationship` varchar(20) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `cliente_id` int(11) DEFAULT NULL,
  `status_id` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_status_id` (`status_id`),
  KEY `idx_results_cashea_gestion_id` (`gestion_id`),
  KEY `idx_results_cashea_cliente_id` (`cliente_id`),
  KEY `idx_results_cashea_idquote` (`idQuote`),
  CONSTRAINT `fk_status_id` FOREIGN KEY (`status_id`) REFERENCES `status` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci

-- TABLA servicios (filas: 4)
CREATE TABLE `servicios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `descripcion` varchar(50) NOT NULL,
  `detalle` varchar(500) DEFAULT NULL,
  `fecha_inicio` date NOT NULL,
  `meta` int(10) unsigned DEFAULT NULL,
  `tipo_flujo` enum('bancario','dinamico') NOT NULL DEFAULT 'dinamico',
  `status_id` int(11) NOT NULL DEFAULT 2,
  `codigo` varchar(10) NOT NULL,
  `campo 2` varchar(10) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uq_servicio_empresa_nombre` (`empresa_id`,`descripcion`),
  KEY `idx_servicio_empresa` (`empresa_id`),
  CONSTRAINT `fk_servicio_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA status (filas: 12)
CREATE TABLE `status` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA subcontacto (filas: 21)
CREATE TABLE `subcontacto` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `descripcion` text NOT NULL,
  `efectivo_id` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci

-- TABLA tipo_cuentas (filas: 5)
CREATE TABLE `tipo_cuentas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) DEFAULT NULL,
  `codigo` int(11) DEFAULT NULL,
  `status_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA transacciones (filas: 4711)
CREATE TABLE `transacciones` (
  `id_transaccion` int(11) NOT NULL AUTO_INCREMENT,
  `fecha` varchar(15) NOT NULL,
  `resultado_id` int(11) NOT NULL,
  PRIMARY KEY (`id_transaccion`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=6104710 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA users (filas: 192)
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `apellido` varchar(50) NOT NULL,
  `user` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `usertype_id` int(11) NOT NULL,
  `status_id` int(11) NOT NULL,
  `servicio_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `usertype` (`usertype_id`) USING BTREE,
  KEY `status` (`status_id`) USING BTREE,
  KEY `servicio` (`servicio_id`) USING BTREE,
  CONSTRAINT `servicio` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`),
  CONSTRAINT `status` FOREIGN KEY (`status_id`) REFERENCES `status` (`id`),
  CONSTRAINT `usertype` FOREIGN KEY (`usertype_id`) REFERENCES `usertypes` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=221 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA usertypes (filas: 3)
CREATE TABLE `usertypes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci ROW_FORMAT=DYNAMIC

-- TABLA usuario_servicios (filas: 193)
CREATE TABLE `usuario_servicios` (
  `user_id` int(11) NOT NULL,
  `servicio_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`servicio_id`),
  KEY `idx_us_servicio` (`servicio_id`),
  CONSTRAINT `fk_us_servicio` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`),
  CONSTRAINT `fk_us_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci

