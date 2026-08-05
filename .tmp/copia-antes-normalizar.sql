--
-- PostgreSQL database dump
--

\restrict qem8vXKbLDJj1sxeoFdQ67p8WGq8lgdKtB1qXfyVLBBEa8m1yw2t0O10eYh69fS

-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: extremo_cable; Type: TYPE; Schema: public; Owner: av_design
--

CREATE TYPE public.extremo_cable AS ENUM (
    'pantalla',
    'proyector',
    'rack',
    'caja_conexiones',
    'mesa',
    'techo',
    'pared'
);


ALTER TYPE public.extremo_cable OWNER TO av_design;

--
-- Name: rol_usuario; Type: TYPE; Schema: public; Owner: av_design
--

CREATE TYPE public.rol_usuario AS ENUM (
    'admin',
    'tei',
    'av',
    'tecnico',
    'lectura'
);


ALTER TYPE public.rol_usuario OWNER TO av_design;

--
-- Name: TYPE rol_usuario; Type: COMMENT; Schema: public; Owner: av_design
--

COMMENT ON TYPE public.rol_usuario IS 'TEI revisa el diseño y propone compra. AV da el visto bueno. Técnico configura e instala.';


--
-- Name: ruta_cable; Type: TYPE; Schema: public; Owner: av_design
--

CREATE TYPE public.ruta_cable AS ENUM (
    'falso_techo',
    'canaleta',
    'suelo_tecnico',
    'directo'
);


ALTER TYPE public.ruta_cable OWNER TO av_design;

--
-- Name: senal; Type: TYPE; Schema: public; Owner: av_design
--

CREATE TYPE public.senal AS ENUM (
    'hdmi',
    'red',
    'usb',
    'audio_linea',
    'audio_altavoz',
    'microfono',
    'alimentacion',
    'control',
    'otro'
);


ALTER TYPE public.senal OWNER TO av_design;

--
-- Name: tipo_articulo; Type: TYPE; Schema: public; Owner: av_design
--

CREATE TYPE public.tipo_articulo AS ENUM (
    'equipo',
    'cable',
    'consumible'
);


ALTER TYPE public.tipo_articulo OWNER TO av_design;

--
-- Name: unidad_medida; Type: TYPE; Schema: public; Owner: av_design
--

CREATE TYPE public.unidad_medida AS ENUM (
    'ud',
    'm'
);


ALTER TYPE public.unidad_medida OWNER TO av_design;

--
-- Name: tocar_actualizado_en(); Type: FUNCTION; Schema: public; Owner: av_design
--

CREATE FUNCTION public.tocar_actualizado_en() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.actualizado_en = now();
  return new;
end $$;


ALTER FUNCTION public.tocar_actualizado_en() OWNER TO av_design;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: articulos; Type: TABLE; Schema: public; Owner: av_design
--

CREATE TABLE public.articulos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referencia text,
    tipo public.tipo_articulo NOT NULL,
    categoria text NOT NULL,
    marca text,
    modelo text NOT NULL,
    descripcion text,
    unidad public.unidad_medida DEFAULT 'ud'::public.unidad_medida NOT NULL,
    coste numeric(12,4),
    pvp numeric(12,4),
    proveedor_id uuid,
    plazo_dias integer,
    stock_minimo numeric(12,2),
    senal public.senal,
    conector_a text,
    conector_b text,
    longitudes_comerciales_m numeric(6,2)[],
    bobina_m numeric(8,2),
    diametro_mm numeric(6,2),
    unidades_instaladas integer,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    caracteristicas text,
    observaciones text
);


ALTER TABLE public.articulos OWNER TO av_design;

--
-- Name: conexiones; Type: TABLE; Schema: public; Owner: av_design
--

CREATE TABLE public.conexiones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sala_id uuid NOT NULL,
    origen_id uuid NOT NULL,
    destino_id uuid NOT NULL,
    articulo_cable_id uuid,
    senal public.senal DEFAULT 'otro'::public.senal NOT NULL,
    ruta public.ruta_cable,
    longitud_manual_m numeric(8,2),
    notas text,
    CONSTRAINT conexiones_check CHECK ((origen_id <> destino_id))
);


ALTER TABLE public.conexiones OWNER TO av_design;

--
-- Name: parametros; Type: TABLE; Schema: public; Owner: av_design
--

CREATE TABLE public.parametros (
    clave text NOT NULL,
    valor numeric(10,4) NOT NULL,
    unidad text,
    descripcion text
);


ALTER TABLE public.parametros OWNER TO av_design;

--
-- Name: plantilla_articulos; Type: TABLE; Schema: public; Owner: av_design
--

CREATE TABLE public.plantilla_articulos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plantilla_id uuid NOT NULL,
    articulo_id uuid,
    categoria text NOT NULL,
    modelo_texto text,
    cantidad numeric(6,2) DEFAULT 1 NOT NULL,
    opcional boolean DEFAULT false NOT NULL
);


ALTER TABLE public.plantilla_articulos OWNER TO av_design;

--
-- Name: plantillas_sala; Type: TABLE; Schema: public; Owner: av_design
--

CREATE TABLE public.plantillas_sala (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    tipologia text NOT NULL,
    aforo integer,
    n_salas_reales integer,
    largo_m numeric(6,2),
    ancho_m numeric(6,2),
    alto_m numeric(6,2),
    alto_falso_techo_m numeric(6,2),
    ruta_por_defecto public.ruta_cable DEFAULT 'falso_techo'::public.ruta_cable NOT NULL,
    notas text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.plantillas_sala OWNER TO av_design;

--
-- Name: COLUMN plantillas_sala.n_salas_reales; Type: COMMENT; Schema: public; Owner: av_design
--

COMMENT ON COLUMN public.plantillas_sala.n_salas_reales IS 'Cuántas salas del inventario responden a esta plantilla. Sirve para priorizar.';


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: av_design
--

CREATE TABLE public.proveedores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    contacto text,
    email text,
    telefono text,
    notas text
);


ALTER TABLE public.proveedores OWNER TO av_design;

--
-- Name: sala_equipos; Type: TABLE; Schema: public; Owner: av_design
--

CREATE TABLE public.sala_equipos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sala_id uuid NOT NULL,
    articulo_id uuid,
    nombre text NOT NULL,
    cantidad integer DEFAULT 1 NOT NULL,
    extremo public.extremo_cable DEFAULT 'pared'::public.extremo_cable NOT NULL,
    x_m numeric(6,2) DEFAULT 0 NOT NULL,
    y_m numeric(6,2) DEFAULT 0 NOT NULL,
    z_m numeric(6,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.sala_equipos OWNER TO av_design;

--
-- Name: salas; Type: TABLE; Schema: public; Owner: av_design
--

CREATE TABLE public.salas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sede_id uuid,
    edificio text,
    nivel text,
    codigo text,
    nombre text NOT NULL,
    tipologia text,
    aforo integer,
    plantilla_id uuid,
    largo_m numeric(6,2) DEFAULT 0 NOT NULL,
    ancho_m numeric(6,2) DEFAULT 0 NOT NULL,
    alto_m numeric(6,2) DEFAULT 0 NOT NULL,
    alto_falso_techo_m numeric(6,2),
    alto_canaleta_m numeric(6,2) DEFAULT 0.30,
    alto_suelo_tecnico_m numeric(6,2) DEFAULT 0,
    ruta_por_defecto public.ruta_cable DEFAULT 'falso_techo'::public.ruta_cable NOT NULL,
    notas text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.salas OWNER TO av_design;

--
-- Name: sedes; Type: TABLE; Schema: public; Owner: av_design
--

CREATE TABLE public.sedes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    ciudad text,
    notas text
);


ALTER TABLE public.sedes OWNER TO av_design;

--
-- Data for Name: articulos; Type: TABLE DATA; Schema: public; Owner: av_design
--

COPY public.articulos (id, referencia, tipo, categoria, marca, modelo, descripcion, unidad, coste, pvp, proveedor_id, plazo_dias, stock_minimo, senal, conector_a, conector_b, longitudes_comerciales_m, bobina_m, diametro_mm, unidades_instaladas, activo, creado_en, caracteristicas, observaciones) FROM stdin;
3bea5108-5c06-45dc-bcc4-678e8e3752ff	\N	equipo	PANEL TACTIL	CISCO	CISCO ROOM NAVIGATOR	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	347	t	2026-08-05 11:02:11.295603+00	\N	\N
c1629983-8c08-44d2-85f1-99555313fc96	\N	equipo	PANTALLA	SAMSUNG	QB65R-B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	264	t	2026-08-05 11:02:11.295603+00	\N	\N
446929ed-548d-4114-97ec-07ed6cc11345	\N	equipo	MICROFONO	CISCO	TABLE MICROPHONE MINI JACK (V1)	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	223	t	2026-08-05 11:02:11.295603+00	\N	\N
ffaf9528-e282-4762-b231-75fdb3a07ee0	\N	equipo	PANTALLA	SAMSUNG	QB65R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	205	t	2026-08-05 11:02:11.295603+00	\N	\N
c642c4d0-eef5-42b3-ab63-dafdd0e5b91c	\N	equipo	PC	LENOVO	M920Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	107	t	2026-08-05 11:02:11.295603+00	\N	\N
def46737-7da9-4124-9a45-8489c73228e9	\N	equipo	CAJA CONEXIONES	BACHMANN	TOPFRAME	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	102	t	2026-08-05 11:02:11.295603+00	\N	\N
009def39-c3a1-4e70-9c2b-d128dd65747d	\N	equipo	MONITOR	SAMSUNG	QB65H	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	75	t	2026-08-05 11:02:11.295603+00	\N	\N
e69c496b-7fda-4313-b9e1-4bbec014c7ba	\N	equipo	PANTALLA	SAMSUNG	QB55R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	71	t	2026-08-05 11:02:11.295603+00	\N	\N
53d2a806-98b5-471d-865e-824cda6960de	\N	equipo	VIDEOCONFERENCIA	CISCO	WEBEX ROOM BAR PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	71	t	2026-08-05 11:02:11.295603+00	\N	\N
2c7d9971-2774-4190-a255-f48aca82a1b8	\N	equipo	BARRA VIDEOCONFERENCIA	AVER	VB342	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	69	t	2026-08-05 11:02:11.295603+00	\N	\N
c6865eb0-4ed8-4b5a-8ded-443f17e19c8e	\N	equipo	ALTAVOZ	GENELEC	4010AW	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	62	t	2026-08-05 11:02:11.295603+00	\N	\N
8045bab6-d5ff-498a-ac27-68592f8778be	\N	equipo	MICROFONO	CISCO	TABLE MICROPHONE MINI JACK (V2)	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	59	t	2026-08-05 11:02:11.295603+00	\N	\N
c1833fd8-0d5a-4601-8baa-1176d89b18c5	\N	equipo	PANTALLA	SAMSUNG	QB55R-B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	59	t	2026-08-05 11:02:11.295603+00	\N	\N
8c0a3a51-7e2d-40a7-bbaa-f1a7d86fcc69	\N	equipo	TRANSMISOR VIDEO	CRESTRON	DM-NVX-E30	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	64	t	2026-08-05 11:02:11.295603+00	\N	\N
df513c7f-e4f5-4e53-8907-725120b6efec	\N	equipo	MONITOR	SAMSUNG	OM75D-W	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	58	t	2026-08-05 11:02:11.295603+00	\N	\N
ecc272b8-6049-436c-8493-a671f986407e	\N	equipo	PANEL TACTIL	CISCO	CISCO TOUCH 10	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	58	t	2026-08-05 11:02:11.295603+00	\N	\N
a0bb7536-8a27-4ef0-936b-b2f911bbe359	\N	equipo	RECEPTOR VIDEO	EXTRON	DTP HDMI 4K 230 RX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	52	t	2026-08-05 11:02:11.295603+00	\N	\N
e6bedede-cd5a-464b-b25a-6ace15764e0e	\N	equipo	MICROFONO	BOSCH	CONCENTRUS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	48	t	2026-08-05 11:02:11.295603+00	\N	\N
02706cf4-f7f6-4ff6-8f45-ec2fc7e8d7c9	\N	equipo	CAMARA	CRESTRON	UC-SB1-CAM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	47	t	2026-08-05 11:02:11.295603+00	\N	\N
88f53305-78b5-4b5f-be72-65eefa0935bd	\N	equipo	PANTALLA ROOMWIZARD	STEELCASE	ROOMWIZARD II	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	45	t	2026-08-05 11:02:11.295603+00	\N	\N
c32a4170-da46-4ed2-af6d-ecc73242d2ff	\N	equipo	TRANSMISOR VIDEO	EXTRON	DTP HDMI 4K 230 TX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	44	t	2026-08-05 11:02:11.295603+00	\N	\N
c2a8012b-2bbc-465a-a6d8-b24b3ccef157	\N	equipo	PANEL TACTIL	CISCO	ROOM NAVIGATOR	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	42	t	2026-08-05 11:02:11.295603+00	\N	\N
3f4f08cd-0892-408b-8a33-e7e12ba55ff1	\N	equipo	MICROFONO	BOSCH	DCN-DISDCS-L	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	40	t	2026-08-05 11:02:11.295603+00	\N	\N
b3addc5b-6eee-4bfb-a04f-b846c1344cd0	\N	equipo	MICROFONO	DICENTIS	DCNM-WD	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	39	t	2026-08-05 11:02:11.295603+00	\N	\N
2b20211d-96fe-4db9-9698-17c0ecac80ba	\N	equipo	RECEPTOR DE VIDEO	CRESTRON	DM-NVX-D30	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	39	t	2026-08-05 11:02:11.295603+00	\N	\N
9b1a61fc-b81c-4b71-a982-a0f1261d4b85	\N	equipo	PC	LENOVO	THINKCENTRE M920Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	35	t	2026-08-05 11:02:11.295603+00	\N	\N
70f2b6fc-48bf-4e03-8612-be802002ea89	\N	equipo	ALTAVOZ	BOSE	FREESPACE DS100F	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	32	t	2026-08-05 11:02:11.295603+00	\N	\N
23380187-7d43-4231-90cc-418463829269	\N	equipo	PANEL TACTIL	CISCO	TOUCH 10	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	31	t	2026-08-05 11:02:11.295603+00	\N	\N
68fe9a22-ca41-4023-875b-94da9c3d5cd5	\N	equipo	CAMARA	CISCO	QUAD CAMERA	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	30	t	2026-08-05 11:02:11.295603+00	\N	\N
88103d63-cfd5-4e6d-b7dc-2db8656168e0	\N	equipo	SOPORTE ALTAVOZ	GENELEC	8000-422B/W	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	30	t	2026-08-05 11:02:11.295603+00	\N	\N
bb660afd-7dbb-4141-8209-5cbdd65ea086	\N	equipo	SOPORTE PANTALLA	VOGELS	T1844	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	30	t	2026-08-05 11:02:11.295603+00	\N	\N
b80ed7c8-441f-4d83-9678-6e9400fbfbf4	\N	equipo	TECLADO/RATON	LOGITECH	MK710	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	27	t	2026-08-05 11:02:11.295603+00	\N	\N
23d154bf-424f-4019-97b2-5fad21d0920f	\N	equipo	MICROFONO	BOSCH	DCN-DVCS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	t	2026-08-05 11:02:11.295603+00	\N	\N
9ae6f7b0-65df-44ca-b1b8-326ea17439e0	\N	equipo	PANTALLA	SAMSUNG	QB65C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	t	2026-08-05 11:02:11.295603+00	\N	\N
418ec4b1-b72a-460f-8db8-36dca735be5b	\N	equipo	PC	LENOVO	M910Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	t	2026-08-05 11:02:11.295603+00	\N	\N
d10c65b5-7a88-4610-a47a-beb565df5bb3	\N	equipo	VIDEOCONFERENCIA	CISCO	ROOM BAR PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	t	2026-08-05 11:02:11.295603+00	\N	\N
c5349967-ce60-45c9-b2f1-3f706eac5097	\N	equipo	TECLADO	LOGITECH	K400+	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	24	t	2026-08-05 11:02:11.295603+00	\N	\N
e3046eb9-f529-41e4-b458-abf6c0f6688c	\N	equipo	BARRA	CRESTRON	UC-SB1-CAM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	t	2026-08-05 11:02:11.295603+00	\N	\N
9ac8ffdb-3d98-4f9f-8a29-cd2f8bedb218	\N	equipo	DOCK STATION	TARGUS	DOCK182	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	t	2026-08-05 11:02:11.295603+00	\N	\N
e08a8641-e1ab-439f-ba68-0d3c69f9d42d	\N	equipo	PANTALLA	SAMSUNG	QB75R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	21	t	2026-08-05 11:02:11.295603+00	\N	\N
dcd58516-2a61-4048-a78b-025833c5bfe6	\N	equipo	PANTALLA	SAMSUNG	DM65D	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	20	t	2026-08-05 11:02:11.295603+00	\N	\N
c883233d-8c20-4fb5-9588-64c46b9af6ad	\N	equipo	PANTALLA	SAMSUNG	QB65N	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	20	t	2026-08-05 11:02:11.295603+00	\N	\N
a98ee372-9a69-45fd-ac53-6ce435602666	\N	equipo	PROYECTOR	SONY	VPL-PHZ10	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	20	t	2026-08-05 11:02:11.295603+00	\N	\N
db4fbb1f-13e4-4119-8735-2a383e5fff29	\N	equipo	MICROFONO	SHURE	BLX2/SM58	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	t	2026-08-05 11:02:11.295603+00	\N	\N
211e429c-3f96-4622-abb6-646d966861a4	\N	equipo	MICROFONO MESA	BOSCH	DCN-CONCS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	t	2026-08-05 11:02:11.295603+00	\N	\N
c9da8b98-8338-4ead-abac-57d2d4998e7f	\N	equipo	PROYECTOR	EPSON	EB-1485FI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	t	2026-08-05 11:02:11.295603+00	\N	\N
698bf3cc-a03e-489f-a53b-63a1342a8dec	\N	equipo	BARRA VIDEOCONFERENCIA	CRESTRON	UC-SB1-CAM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	t	2026-08-05 11:02:11.295603+00	\N	\N
bd6a5b6c-f271-4731-8fe5-449b6c98ab20	\N	equipo	MICROFONO	SHURE	BLX1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	t	2026-08-05 11:02:11.295603+00	\N	\N
abdf448b-0213-4186-9d5c-055b9653b366	\N	equipo	PANTALLA	SAMSUNG	PM43H	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	t	2026-08-05 11:02:11.295603+00	\N	\N
ae6cf345-f2ad-48a7-8d3f-9fbfe2897591	\N	equipo	VIDEOCONFERENCIA	CISCO	WEBEX ROOM EQ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	t	2026-08-05 11:02:11.295603+00	\N	\N
610f7012-2db3-4a57-b953-d1ef840d634f	\N	equipo	MICROFONO	BEYER ORBIS	MU21	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	t	2026-08-05 11:02:11.295603+00	\N	\N
bce7e987-862a-4ed6-870f-ec7dae9aafb3	\N	equipo	MONITOR	ARTHUR HOLM	AH19DX216GA2M2P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	t	2026-08-05 11:02:11.295603+00	\N	\N
2d901a50-20d4-46ff-b119-e32aab6d2932	\N	equipo	PROYECTOR	EPSON	EB-L630U	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	t	2026-08-05 11:02:11.295603+00	\N	\N
c155ba04-b819-4f1a-9265-5a2d1db00da9	\N	equipo	TRANSMISOR DE VIDEO	CRESTRON	DM-NVX-E30	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	t	2026-08-05 11:02:11.295603+00	\N	\N
262c553f-c238-471f-8c2f-f1975dccaeec	\N	equipo	ALTAVOZ	GENELEC	4010AM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	15	t	2026-08-05 11:02:11.295603+00	\N	\N
3899d436-6fd0-42b8-9879-d89b09f7265b	\N	equipo	MICROFONO	BOSCH	LBB4144/00	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	15	t	2026-08-05 11:02:11.295603+00	\N	\N
5032636a-3a2d-44a2-9cc7-d7e257a5a632	\N	equipo	PUPITRES AUDIO	BOSCH	LBB4144/00	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	15	t	2026-08-05 11:02:11.295603+00	\N	\N
45e651a8-7066-418c-b231-c7fad06c8921	\N	equipo	TOTEM PANTALLA	VOGELS	CONNECT-IT TROLLEY	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	15	t	2026-08-05 11:02:11.295603+00	\N	\N
524c9237-b7fd-4ec7-a7cc-00d666bdfb28	\N	equipo	BANDEJA CAMARA	VOGELS	PVA 5050	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	t	2026-08-05 11:02:11.295603+00	\N	\N
22093f26-4fb8-43f5-b46b-7fa7e050a65b	\N	equipo	CAJA CONEXIONES	AMX	HPX 1200	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	t	2026-08-05 11:02:11.295603+00	\N	\N
bbecd276-e84a-4180-a6e4-1e233e3eafe4	\N	equipo	DOCK STATION	TARGUS	DOCK 192-A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	t	2026-08-05 11:02:11.295603+00	\N	\N
401875b0-ba8e-4b31-8fe0-18f4910e43ea	\N	equipo	DOCKSTATION	TARGUS	DOCK180EUZ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	t	2026-08-05 11:02:11.295603+00	\N	\N
9ab1e9fa-52bb-4d4c-bcd0-b721a5bc882d	\N	equipo	TECLADO	LOGITECH	K400 PLUS TV	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	t	2026-08-05 11:02:11.295603+00	\N	\N
dec3c8a7-882e-40d1-8315-03fb21c671c2	\N	equipo	VIDEOCONFERENCIA	CISCO	WEBEX ROOM EQ QUADCAM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	t	2026-08-05 11:02:11.295603+00	\N	\N
e849490e-f860-441d-b80c-345fb7925d42	\N	equipo	CAMARA	CISCO	P60	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	t	2026-08-05 11:02:11.295603+00	\N	\N
5a9de5a4-ff11-4841-a20a-689169b94767	\N	equipo	MICROFONO	YEALINK	VCM35	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	t	2026-08-05 11:02:11.295603+00	\N	\N
25875784-88e3-464c-8488-97f9dd506e9a	\N	equipo	MONITOR	ALBIRAL	AH17TXHDGA	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	t	2026-08-05 11:02:11.295603+00	\N	\N
f9ee1f98-6373-43a3-84b5-0b072338a5a0	\N	equipo	RECEPTOR VIDEO	CRESTRON	DM-NVX-D30	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	t	2026-08-05 11:02:11.295603+00	\N	\N
3199fc1d-dccc-4009-bba2-2c22b4fb9623	\N	equipo	TRANSMISOR VIDEO	CRESTRON	DM-NVX-E20	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	t	2026-08-05 11:02:11.295603+00	\N	\N
3d8b9f86-7037-40ae-ad44-205d4b6207ad	\N	equipo	CONTROLADORA	EXTRON	IPCP PRO 250	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	t	2026-08-05 11:02:11.295603+00	\N	\N
40ab0ca7-0fec-4d52-9a9d-bea89ec982e2	\N	equipo	ESCALADOR	EXTRON	IN1604 HD	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	t	2026-08-05 11:02:11.295603+00	\N	\N
06a23488-da39-40e8-bb97-24f047b75b0c	\N	equipo	MICROFONIA	SHURE	BLX1288/W85 COMBO S8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	t	2026-08-05 11:02:11.295603+00	\N	\N
27505a84-cc3a-4ef4-aec5-9a37925b7feb	\N	equipo	PANEL CISCO	CISCO	CISCO ROOM NAVIGATOR	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	t	2026-08-05 11:02:11.295603+00	\N	\N
bef6e934-c5f4-4d01-b4e9-406b5c2004d8	\N	equipo	VIDEOCONFERENCIA	CISCO	ROOM KIT EQ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	t	2026-08-05 11:02:11.295603+00	\N	\N
673cbd38-14d0-4bca-b46e-1bf7ba3e39fc	\N	equipo	ALTAVOCES	GENELEC	4010A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	t	2026-08-05 11:02:11.295603+00	\N	\N
cffeb6b0-4ff8-42f6-aec4-a7f942046335	\N	equipo	MICROFONO	CISCO	TABLE MICROPHONE 20	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	t	2026-08-05 11:02:11.295603+00	\N	\N
5641ce63-61ce-4f33-8f3b-1f7cb3264f6f	\N	equipo	MONITOR	SONY	LMD-150S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	t	2026-08-05 11:02:11.295603+00	\N	\N
a3697f28-3578-4b35-bc3b-f848d22ac4cb	\N	equipo	PANTALLA	SAMSUNG	QB43R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	t	2026-08-05 11:02:11.295603+00	\N	\N
cc7c1ff9-92cc-481e-a4ac-897eb3137da2	\N	equipo	PANTALLA	SAMSUNG	QB65B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	t	2026-08-05 11:02:11.295603+00	\N	\N
bb85ed58-6715-498d-a391-38b839dc4cb3	\N	equipo	ALTAVOCES TECHO	MONITOR AUDIO	PRO-65	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	t	2026-08-05 11:02:11.295603+00	\N	\N
e0140c1c-0bdf-44b8-b492-fe34edd5f3f2	\N	equipo	BARRA VIDEOCONFERENCIA	CISCO	CISCO ROOM KIT	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	t	2026-08-05 11:02:11.295603+00	\N	\N
b4e0cf7f-0a5e-47c1-ba20-8c9f9083bf42	\N	equipo	CONTROLADORA	CRESTRON	MC4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	t	2026-08-05 11:02:11.295603+00	\N	\N
af602a21-eda1-441d-9c93-738da8cdc351	\N	equipo	CAMARA	AVER	CAM520PRO POE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	t	2026-08-05 11:02:11.295603+00	\N	\N
e22b40e6-7597-4889-806a-c5c475b3f30d	\N	equipo	MICROFONO	BIAMP	TESIRA PARLÉ TCM-XEX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	t	2026-08-05 11:02:11.295603+00	\N	\N
98c918cd-3f7b-4586-a4e4-218c832bde20	\N	equipo	MICROFONO	BOSCH	DCN-CON	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	t	2026-08-05 11:02:11.295603+00	\N	\N
eaed63d0-cd3e-4369-a252-91278cd759fa	\N	equipo	BARRA	AVER	VB342	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	t	2026-08-05 11:02:11.295603+00	\N	\N
7bb3b689-d59d-4299-8739-d5c6861bdfd2	\N	equipo	CAMARA	CISCO	PTZ 4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	t	2026-08-05 11:02:11.295603+00	\N	\N
c560fb51-96f8-499e-96cf-880537edbbf4	\N	equipo	EXTENSOR	CRESTRON	HD-RXU-4KZ-101-E DM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	t	2026-08-05 11:02:11.295603+00	\N	\N
181e7fd3-e357-428c-8fef-1d5de339fc2e	\N	equipo	EXTENSOR	CRESTRON	HD-TXU-4KZ-211-CHGR	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	t	2026-08-05 11:02:11.295603+00	\N	\N
2a6ffc0e-3f72-404c-a9e5-393707230f7d	\N	equipo	MONITOR TACTIL	NEWLINE	TT-2721AIO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	t	2026-08-05 11:02:11.295603+00	\N	\N
8484b0a0-81e7-4157-ad07-acce33ddbff7	\N	equipo	PANTALLA	SAMSUNG	QM32R-B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	t	2026-08-05 11:02:11.295603+00	\N	\N
1d69affe-6cb6-4b06-a61e-39db8c8f1148	\N	equipo	PROYECTOR	LG	LGBU50NST	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	t	2026-08-05 11:02:11.295603+00	\N	\N
3e9481e1-492f-467c-9e67-8d085c8b1d35	\N	equipo	SWITCH	NETGEAR	GS305EP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	t	2026-08-05 11:02:11.295603+00	\N	\N
a7530785-9354-4e73-9ed6-0177b7c66a8d	\N	equipo	TECLADO/RATON	LOGITECH	K400+	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	t	2026-08-05 11:02:11.295603+00	\N	\N
5cbfd75b-4854-456c-a605-8e00aad353c2	\N	equipo	TOUCH PANEL	CISCO	CISCO TOUCH 10	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	t	2026-08-05 11:02:11.295603+00	\N	\N
e9cca7dd-45ad-46aa-8da4-cfa23a3c181e	\N	equipo	TRANSMISOR VIDEO	CRESTRON	DM-NVX E20	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	t	2026-08-05 11:02:11.295603+00	\N	\N
6739836f-4c90-4d87-a878-68c511731679	\N	equipo	VIDEOCONFERENCIA	CISCO	ROOM KIT PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	t	2026-08-05 11:02:11.295603+00	\N	\N
fd5feb16-187f-49c0-9680-b08f76902c75	\N	equipo	ALTAVOCES	GENELEC	4010AW	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
cfcbcf84-6331-40ed-bf1e-08ebe25053ef	\N	equipo	ALTAVOZ	BOSE	FREESPACE 3	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
b187d8c5-dadf-4a0b-95b1-c502a869ae55	\N	equipo	ALTAVOZ	MONITOR AUDIO	PRO-65	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
5bf2c1e8-673f-42f5-a5cb-7a2cb26a519f	\N	equipo	BARRA VIDEOCONFERENCIA	YEALINK	A40	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
1cbc0e79-0d29-4507-a9b2-cd5ce0f98136	\N	equipo	CONTROLADORA	CRESTRON	MC4 (PC)	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
ad35c83f-1054-4b20-98d7-00cb9fa95705	\N	equipo	CONTROLADORA	CRESTRON	RMC4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
67032d00-01e8-408f-9ea5-ce8c4d242f73	\N	equipo	CONTROLADORA PROYECTOR	EPSON	ELPHD02	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
e80ba1ec-92d1-4e99-bb7b-5eb167107e27	\N	equipo	ESCALADOR	CRESTRON	HD-RX-4K-510-CE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
7210eead-24cf-4717-85c2-5ec1236d4b18	\N	equipo	EXTENSOR	YEALINK	VCH51	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
60d563c9-ab55-4aa0-bcff-b2dda9f4ef08	\N	equipo	KIT BOTONES	EXTRON	CB-100-010525	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
97c1d17b-41b6-4efb-934b-ae035b8bb07e	\N	equipo	MONITOR	LG	75XS4G-BJ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
eaba0ef1-4ee5-4da1-96fd-379eebe37496	\N	equipo	PANEL TACTIL	CRESTRON	TS-1070	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
930bc79e-b190-46cc-9a0d-bedd76e97211	\N	equipo	PANTALLA	SAMSUNG	DM55E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
861f89bd-0ec5-40ca-a1d0-918f9d4ca0f4	\N	equipo	PANTALLA	SONY	FW - 65X8570C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
3a44bca8-20ab-4c45-a5f3-85a0f796f952	\N	equipo	RECEPTOR VIDEO	CRESTRON	DM-NVX-D20	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
66dfb968-598c-4b13-bf4e-20fb46e9af38	\N	equipo	TELEFONO IP	CISCO	CP-7945G	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
2fa2784a-b53c-4a48-88b0-8e8b4d71c555	\N	equipo	VIDEOCONFERENCIA	CISCO	ROOM BAR BYOD	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
35121c5b-920e-4f0a-be36-39135c5a3893	\N	equipo	CAMARA	SONY	SRG-X400	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
a113023a-221a-4b52-9d0d-25fa9d153ec2	\N	equipo	EXTENSOR VIDEO	EXTRON	TX DTP3 T 202	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
09c2697c-119c-4330-8d7c-54b9bdb535f9	\N	equipo	MATRIZ	LIGHTWARE	UCX-4X2-HC30	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
67310de7-5b54-420a-88b3-449e8b380bae	\N	equipo	PANTALLA	SAMSUNG	QB55N	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
64dc9586-cef7-4fa6-83d8-3283547c7bfe	\N	equipo	PANTALLA	SAMSUNG	QB75N	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
5d45a122-2d46-4ec7-8997-7054c39f3b67	\N	equipo	PANTALLA	SONY	KDL-55W802A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
6d76bb24-5401-4ccb-a217-a4591150c803	\N	equipo	PANTALLA	SONY	KDL-65W855A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
c03837a2-b31d-4f9b-8818-76bd881ca75c	\N	equipo	PC	HP	PRODESK 600 G4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
15c38c26-eb6f-4006-a9a4-e7ea54f99453	\N	equipo	SOPORTE PROYECTOR	TRAULUX	SPT-82120	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
41045148-f73d-419a-9cca-2339ed050729	\N	equipo	TECLADO	LOGITECH	K750	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
dc03b2cd-d61e-4b30-8a10-adc687e92629	\N	equipo	TOTEM PANTALLA	VOGELS	FD 2064 S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
cfa849da-3b12-4858-8e96-f5e60c02dac9	\N	equipo	VIDEOCONFERENCIA	YEALINK	A20-010	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
8928d505-5455-4925-a639-eb98d556aa3b	\N	equipo	ALTAVOZ	GENELEC	4020C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
30a13605-9f69-4d5a-a613-2091f5ed9b8f	\N	equipo	AMPLIFICADOR	BITTNER	BASIC 400	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
5c814ce2-7eab-4890-9d07-f3599bfe977e	\N	equipo	CAMARA	AVER	CAM 520 PRO POE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
c2db9458-ab54-49f3-8d01-38c3c2ab3039	\N	equipo	CAMARA	AVER	VC520	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
80b65015-d885-46f5-b7bd-e6d8d454bd74	\N	equipo	CAMARA	AVER	VC520+	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	t	2026-08-05 11:02:11.295603+00	\N	\N
56eb22eb-62fc-4957-bea2-9d31e2672dd4	\N	equipo	DISTRIBUIDOR VW	SAMSUNG	SNOWJAU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
5d772e87-a8a1-4368-b19a-9dbe79ae2ac2	\N	equipo	DOCK STATION	TARGUS	DOCK-190C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
9ea7db43-1848-48cf-86a6-4e41e4713172	\N	equipo	EMBEBEDOR DE AUDIO	BLUESTREAM	HD11AU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
2e18ac44-0fbd-42a9-94a7-f666ad3c9f5f	\N	equipo	ESCALADOR	EXTRON	IN1604HD	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
07bb7c42-4806-49c8-9c44-e148483cc122	\N	equipo	KIT TECLADO Y RATON	LOGITECH	MK700	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
b076136c-c3ba-4c52-a0b2-10b638b32ef0	\N	equipo	MICROFONO	BIAMP	TESIRA PARLE TCM-X	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
f00406c5-3975-4af8-a3e9-0889988e6522	\N	equipo	MICROFONO	BIAMP	TESIRA PARLE TCM-XEX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
3c7337c0-64f7-4bfd-b2d5-638dbaeb81c5	\N	equipo	PANEL TACTIL	CRESTRON	TSW-770-BS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
63cd6b49-80c2-4543-9915-1cd457a43a50	\N	equipo	PANTALLA	SAMSUNG	DM65E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
792bfb87-6fa2-41d9-8093-5bb6ae9ed494	\N	equipo	PANTALLA	SAMSUNG	QB43-B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
518aad71-ee64-4969-a497-8cdd5a0581cb	\N	equipo	PANTALLA	SAMSUNG	QB55B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
dca05036-74dc-4a16-8c61-b150ba6f65ed	\N	equipo	PANTALLA	SAMSUNG	QB55C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
af26c1b9-2be9-46cb-b9a5-8078856d2bbe	\N	equipo	PANTALLA	SAMSUNG	QB75C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
14024719-4487-474d-9c28-cdde8cf5253e	\N	equipo	PC	LENOVO	THINKCENTRE M910Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
00d7329a-390a-46e4-b301-73c5e8706f59	\N	equipo	PC	LENOVO	THINKCENTRE M93P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
199a2a95-0947-42e3-88da-6585f076e1f3	\N	equipo	RECEPTOR	EXTRON	DTP HDMI 4K 230 RX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
e0f2883f-a224-4ee7-97a3-5d076f9fda0b	\N	equipo	RECEPTOR VIDEO	CRESTRON	DM-NVX D20	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
78cf4ace-2972-4a99-9803-7935221b28dd	\N	equipo	RECEPTOR VIDEO	CRESTRON	DM-NVX-D200	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	t	2026-08-05 11:02:11.295603+00	\N	\N
f441fd63-eee3-4dce-a1f5-dc7594969c8b	\N	equipo	SOPORTE	VOGELS	PFW 4510	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
25bdc581-5b52-4d59-bcf5-f2e074760591	\N	equipo	TECLADO INALAMBRICO	LOGITECH	K400	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
29b4b944-7795-4bee-82cf-9028538ef883	\N	equipo	TOTEM PANTALLA	FONESTAR	RL38	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
475bcf4b-96a0-4468-a35e-2b68d6ef3b9e	\N	equipo	TRANSMISOR VIDEO	EXTRON	DTP HDMI 230 TX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
331f049a-0ae4-49da-810a-8b5993ac3e21	\N	equipo	UNIDAD CONTROL MICROFONIA	BOSCH	DCN-CCU2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
776bc63a-be0a-418e-9085-b747e75aaed7	\N	equipo	WEBCAM	JABRA	PANACAST	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
1e407b58-a808-4b60-bd33-c62ad8224561	\N	equipo	BARRA	AVER	VB342 BARRA	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
322036f2-5f40-479b-a0d1-4b823bba62a6	\N	equipo	BARRA	JABRA	PANACAST 50	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
98b49494-a719-404b-aa99-35fb88382755	\N	equipo	BASE CARGA MICROFONO	SHURE	SBC203	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
8906db81-ef58-49aa-b659-2964e19e0b30	\N	equipo	BOTONERA	EXTRON	MLC 62 RS CC	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
8c132e78-0811-4b50-9a55-2779c1d1e93d	\N	equipo	CAJA DE MESA	EXTRON	CABLE CUBBY 1200 NEGRO 70-1037-02	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
0399c678-ee2f-462e-97d5-e87f38d1249a	\N	equipo	CAMARA	AVER	PTC310H	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
d9d6a60d-363c-4aa7-a4c8-cde7109d1a8d	\N	equipo	CAMARA	AVER	VB342	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
54a284bc-aaa2-4693-abe8-3299ea8220fa	\N	equipo	CAMARA	AVER	VC520PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
36a9c97e-f61e-4c3c-b142-c3c4d92efd3c	\N	equipo	CAMARA	CISCO	PTZ4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
9ba319d9-f6c5-44c8-951d-c97bb6d05d51	\N	equipo	DISTRIBUIDOR	CRESTRON	HD-DA8-4KZ-E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
2e5265c4-88bf-4c42-8ced-f89c387de482	\N	equipo	EMBEBEDOR AUDIO	BLUESTREAM	HD11AU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
894564fa-6e86-411e-96d8-55b94945ad7f	\N	equipo	EMISOR VIDEO	CRESTRON	DM-NVX-E30	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
81e9b35b-afc2-4029-9cec-e6f7c830d631	\N	equipo	EXTENSOR VIDEO	EXTRON	RX DTP3 R 201	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
b8514423-6130-478b-8e03-9668c7f50695	\N	equipo	MICROFONO	AVER	VC520+	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
4a020991-916e-4745-988c-2131d7159cb3	\N	equipo	MONITOR	SAMSUNG	QB65C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
ee572e24-6f34-48ee-b67b-7af8355a3ff2	\N	equipo	PANTALLA	PHILIPS	70BFL2214/12	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
75fb6264-0bb3-4245-bd97-e7d12b94b6d7	\N	equipo	PANTALLA	SAMSUNG	QM43B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
dbc521ca-d8ff-417b-bef4-0198c44ee2ed	\N	equipo	PANTALLA DE PROYECCION	COMM-TEC	CP-MO120	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
d1257032-7b00-4518-adc9-ebd193d8bf1e	\N	equipo	PASADOR	LOGITECH	SPOTLIGHT	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
04f0fa20-e4c4-4368-b572-4bd12e228b22	\N	equipo	PROYECTOR	EPSON	EB-L690U	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
2b617018-98f1-44c5-b463-c4356e7b3f40	\N	equipo	PUPITRE	BOSCH	DCN-IDESK-L	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
7a9350c4-15be-428e-8dc9-b716d24a9792	\N	equipo	RECEPTOR MICROFONO	SHURE	BLX4R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
7124467b-4716-417c-af88-da3fbcf53a7a	\N	equipo	RECEPTOR VIDEO	CRESTRON	HD-RX-4KZ-101	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
ce09dad2-7dce-4d9b-bc00-9665171300e5	\N	equipo	SOPORTE PANTALLA	VOGELS	FD 2064S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
3bec83e6-60ab-4a16-948b-1c01cd156496	\N	equipo	TECLADO	LOGITECH	MK710	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
ef544b88-2ce8-4e0a-a5d3-8e99bb3eb930	\N	equipo	TECLADO	LOGITECH	MX3200	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
965813c1-d20e-432e-9b5e-00f9ee194915	\N	equipo	TELEFONO IP	CISCO	CP-7937G	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
931286f7-9ae7-4a33-b10e-d24a1ae2fe32	\N	equipo	TELEFONO IP	CISCO	CP-7962G	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
f74dca9a-cd6e-4618-a770-90867fb5b930	\N	equipo	TRANSMISOR VIDEO	CRESTRON	HD-TX-4KZ-101	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
4ad379a1-bcc7-4fb2-bc79-9706331b74c3	\N	equipo	VIDEOCONFERENCIA	CISCO	ROOM KIT PLUS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	t	2026-08-05 11:02:11.295603+00	\N	\N
862d74a7-2933-4e86-b3b5-938536597c5c	\N	equipo	ALTAVOCES TECHO	LDA	XC-65	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
9260adb2-b880-4ff5-9405-169c77cb1324	\N	equipo	ALTAVOZ	BOSE	DS100SE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
43c77227-0c1e-4342-a484-76a4d0bec3b6	\N	equipo	ALTAVOZ	BOSE	FREESPACE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
01e92fa7-b586-483e-bd3f-7853709b60fc	\N	equipo	ALTAVOZ	BOSE	FREESPACE DS 100SE WH	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
a6ba59e4-4ff4-4719-b0de-a5b55f27715e	\N	equipo	ALTAVOZ	BOSE	UL 1480	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
e4238272-70de-4ff5-b79e-d9cebe3efd7b	\N	equipo	ALTAVOZ	MEYER SOUND	MM-4XP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
511f2e5e-d1cf-4157-8121-8980fa47574a	\N	equipo	ALTAVOZ	VIETA	DO-8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
c22f7e6b-9dff-44cf-a228-30a4f75774be	\N	equipo	AMINO	TRIPLEPAY	TPS-SPI-4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
ca997927-5fc9-43ef-b673-ad7a0c8ac724	\N	equipo	CAJAS ACUSTICAS	GENELEC	4010AW	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
ab76258f-b7c6-43c2-bafb-4b42313e165e	\N	equipo	CARGADOR DICENTIS	BOSCH	DCNM-WCH05	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
74c0807e-07c8-45fa-8311-e5f883ef6b2d	\N	equipo	CONTROLADORA	AMX	NX 1200	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
434ee956-4f35-4aa9-bc4c-7e37b34e27bb	\N	equipo	CONVERSOR	EXTRON	RGBHDMI 300A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
00394d21-90b4-49e0-b1cd-5386fde0ba0c	\N	equipo	CAMARA	CANON	CR-N300	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
e83a14e1-2111-4e5d-bd8f-92bb6ddd7793	\N	equipo	CAMARA	CISCO	CTS-CAM-P60	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
e6e97c68-ec40-4d8b-9d4a-2b267c988184	\N	equipo	CAMARA	SONY	EVI-X2000C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
82231f20-c8bf-4552-a4b1-2b0fd9fe71b2	\N	equipo	ESCALADOR	EXTRON	DVS 605	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
7ecb286e-e173-4443-a9db-95a8fa8cf07d	\N	equipo	ESCALADOR	EXTRON	DVS-605-A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
243e11db-38c1-46c2-869e-39c757537388	\N	equipo	HDMI EMBEBEDOR/DESEMBEBEDOR	BLUSTREAM	HD11AU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
b862e1c0-019c-4665-aaab-17ca5d8d9359	\N	equipo	INTERFACE DE AUDIO DANTE, PARA MIC ANALOGICO A DIGITAL DANTE	SHURE	ANI4IN	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
a7f71cc1-3ab7-4734-99ab-0e5ba8b446b4	\N	equipo	MATRIZ	EXTRON	DTP CROSSPOINT 108	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
c460dd6f-636e-4e90-b3fe-5b22788c731a	\N	equipo	MICROFONO	AVER	VC520	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
6b0574ea-9155-43d3-902b-b1f7040d132c	\N	equipo	MICROFONO	CISCO	TABLE MICROPHONE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
6cee18b6-98d5-444b-9902-1827879dd092	\N	equipo	MICROFONO	SENNHEISER	E835	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
e6cac71b-058e-416b-a50a-49cf806e24ce	\N	equipo	MICROFONO	SENNHEISER	SK2000	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
7baace9b-3369-45cf-ae16-8fe5c24ad9b4	\N	equipo	MICROFONO	SENNHEISER	SK2000 558-626 MHZ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
f9a35f5a-d34f-4061-a722-4ef4cdbedfe6	\N	equipo	MICROFONO	SENNHEISER	SKM2000 558-626 MHZ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
f408e4ec-46e3-40ff-a590-f5ee23d45877	\N	equipo	MICROFONO	SHURE	MXA920W-S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
75c36c03-20f0-4d56-a908-66acc67f8143	\N	equipo	MICROFONO	SHURE	SLXD1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
96bf7722-6de2-4a97-bbbe-c62ac770865f	\N	equipo	MICROFONO	SHURE	SLXD2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
382919af-57fe-426b-9426-78df9ea0ac92	\N	equipo	MICROFONO	SHURE	WL185	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
e63b8728-df05-42d9-b836-76085a908783	\N	equipo	MICROFONO EXTENSOR	BIAMP	TESIRA PARLÉ TCM-X	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
75037d6b-c533-4fe8-a5c8-dd652933e531	\N	equipo	MICROFONO MESA	CISCO	TABLE MICROPHONE MINI JACK (V1)	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
2db96a0a-2bdb-4faf-a1ac-b01f862af04f	\N	equipo	MONITOR	SMART	PODIUM 524	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
078d05a8-e72d-4d11-b9c2-a0a0008e3240	\N	equipo	PANTALLA	IIYAMA	LH4340S-B1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
2b495211-81cb-485a-a960-53118075f8c2	\N	equipo	PANTALLA	PHILIPS	65PUS6162/12	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
2ad8827e-86f0-409b-b8e7-543a357b6a4e	\N	equipo	PANTALLA	PIONNER	43MXE1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
e72f10fb-678b-45fa-be71-94a7ed44c92c	\N	equipo	PANTALLA	SAMSUNG	DM55D	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
a517365c-2499-4575-8296-5fa1ded3de1b	\N	equipo	PANTALLA	SAMSUNG	LH55QMBEBGCXE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
4efdc46e-052b-444a-a80a-5acd93744e8e	\N	equipo	PANTALLA	SAMSUNG	QB43B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
e17fa7c6-1476-4cef-b7cc-fae7614a2b02	\N	equipo	PANTALLA ELECTRICA	PLUSSCREEN	INACCESIBLE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
df09d471-20c4-4e23-80d5-9b24af905a8f	\N	equipo	PASARELA	CRESTRON	HD-CTL-101	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
95cffada-b9cd-4cad-81d2-44409ba4b37f	\N	equipo	PC	HP	600 MINI G4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
5653f17a-9d86-48d4-90d2-c69fa2da9d64	\N	equipo	PC	HP	ELITEDESK 800 G5	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
af58c193-0ec9-4d89-8f3a-1f819d4b497b	\N	equipo	PC	LENOVO	M70Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
6a8c47ff-60b5-430a-8dbb-d93afc21af14	\N	equipo	PROCESADOR AUDIO	XILICA	SOLARO QR1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
1e324361-c9bb-4c48-896a-297961c3c29b	\N	equipo	PROCESADOR DE AUDIO	BIAMP	TESIRAFORTÉ AVB VT4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
3f187793-ccc5-4329-b0d4-8e8ec6df7bc5	\N	equipo	PROYECTOR	EPSON	EB-G5300	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
f83f32ba-cadc-48cb-9fb1-7957d592b3c0	\N	equipo	PROYECTOR	EPSON	EB-L530U	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
cc625975-f0c1-40c3-be57-b16968db8bf3	\N	equipo	PROYECTOR	LG	BU50NST	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
62da93a1-dbe4-496a-9892-4ddb2f99c063	\N	equipo	PROYECTOR	SONY	VPL-FH31	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
ac1c0b4a-90d2-4d49-9c0e-4d275aa794c9	\N	equipo	RECEPTOR MICROFONO	SENNHEISER	EM2050 558-626 MHZ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
cd61d2e6-6536-4c9f-a74c-abb9f3f6d190	\N	equipo	RECEPTOR MICROFONO	SHURE	SLXD4D	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
39a06439-b1eb-4457-bb41-9106be7ed1c9	\N	equipo	RECEPTOR VIDEO	CRESTRON	DM-NVX D200	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
00af98cf-3b93-4965-8745-0c780c7085ea	\N	equipo	SOPORTE	INDETERMINADA	TECHO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
0ab74094-ac1b-4ca0-9d9f-bde2d8dbba43	\N	equipo	SOPORTE	VOGELS	PPC 1585 SOPORTE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
c52041c9-2ba2-4359-a6ac-77d5f597b28b	\N	equipo	SWITCH	DANTE	SWITCH TP- LINK	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
34903734-c060-45ac-8fef-f5f6b7039480	\N	equipo	TOTEM PANTALLA	VOGELS	SINRUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
fab3c82f-dae3-4f61-9484-27ae5142f844	\N	equipo	TOUCH PANEL	CISCO	CISCO ROOM NAVIGATOR	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
d0a81ba7-d154-4f71-9904-a1b798bb11a4	\N	equipo	UNIDAD CONTROL MICROFONIA	BOSCH	DCN-CCU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
d49cf15e-0653-4670-8793-0765ce24e0d2	\N	equipo	VIDEOCONFERENCIA	CISCO	CODEC PLUS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
8660dcbc-ad78-45fd-b99b-0d187b6ae93b	\N	equipo	VIDEOCONFERENCIA	CISCO	CS-KIT-K9	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
e5373705-9572-4100-b773-1b5b9f61bbe6	\N	equipo	VIDEOCONFERENCIA	CISCO	ROOM BAR	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
4a04281a-181c-4c3d-aa9a-e8dcd451b332	\N	equipo	ALTAVOCES (X4)	BOSE	INACCESIBLE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
45ae2e7f-9429-443d-a452-df8404085d07	\N	equipo	ALTAVOZ	BOSCH	LB1-UM20E-D	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
7ecb94e0-6bdf-4dc4-8cc0-c8b2b29542b6	\N	equipo	APPLE TV	APPLE	APPLE TV 4 GEN	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
bdd54e5f-9303-4869-88be-be52c75a36ab	\N	equipo	BARRA	YEALINK	A40	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
096bc563-28e2-4fbc-871f-767f83b88a13	\N	equipo	BARRA VIDEOCONFERENCIA	CISCO	CISCO ROOM PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
0c4d2522-9abc-4970-adfa-6b4fae44ab61	\N	equipo	BOTONERA	EXTRON	MLC 62 RS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
dad3e437-e5e3-41a2-a076-8367eaf9b346	\N	equipo	CAJA DE MESA	EXTRON	CABLE CUBBY 1200 (202EU)	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
8e184033-68a9-4f0d-8fa3-5a4973618146	\N	equipo	CAPTURADOR PANTALLA	KAPTIVO	WALL MOUNT CAMERA	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
82fe33ab-184c-4aab-be93-b6bb7f9aff36	\N	equipo	COMPARTICION INALAMBRICA	APPLE	APPLE TV 4 GEN	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
ef3d9051-e4a8-44e4-aad0-b476fc83908c	\N	equipo	CONVERSOR	EXTRON	DPM‑HDF 4K PLUS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
3fe90df4-ee1f-48d9-a07c-9c5dc04ca323	\N	equipo	CONVERSOR CATX - HDMI	KAPTIVO	KW100	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
dbeffd27-6623-47dc-8cd1-73f640faa02b	\N	equipo	CAMARA	CISCO	PRECISION 60	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
afe2cce5-20c2-434d-8403-9caa13614f19	\N	equipo	CAMARA	CISCO	QUADCAM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
12b828a7-d80a-4f7a-bc10-a8b72aff7261	\N	equipo	CAMARA	LOGITECH	GROUP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
37d084e1-0811-47f4-aab4-e9312bfaaf58	\N	equipo	CAMARA	SONY	SRG-A12	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
b6616de3-a5a0-4b89-989d-1cd7fb6ae5a9	\N	equipo	DANTE	ATTEROTECH	UNDIO2X2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
fe0c94ff-fda8-42db-85aa-2d3e5da38193	\N	equipo	DISTRIBUIDOR	EXTRON	DA6	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
2962d65d-c794-4987-88ac-f74b1f17500f	\N	equipo	DOCK STATION	TARGUS	DOCK192	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
ce223b2e-b6db-4b95-98e3-b802407dafd5	\N	equipo	EMISOR HDBASET	CRESTRON	HD-TXC-4KZ-101	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
481e705d-7484-41a7-b3dc-a9eeeb0dccd6	\N	equipo	ESCALADOR	EXTRON	IN 1608SA	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
b11b0141-02e6-40d9-8571-3bb6a7274830	\N	equipo	ESCALADOR	EXTRON	IN1604	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
5dd6e9b6-ea8e-44bb-a6b0-1c1524ae2a5f	\N	equipo	KIT TECLADO Y RATON	LOGITECH	K400+	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
3595f465-dcf2-4cf7-991b-51dfe7507ec7	\N	equipo	MICRO BEAMTRACKING	BIAMP	TESIRA PARLÉ TCM-1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
bb38ff56-54de-4c2f-896c-b129ce6d67a7	\N	equipo	MICROFONO TECHO	SHURE	MXA 920W-S-60	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
e5c51125-ca8a-4317-92e2-8ba0dfb91c23	\N	equipo	MICROFONIA	BEYERDYNAMIC	TG500H-C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
0f7bc312-c963-41b0-939c-ff81d24aab87	\N	equipo	MICROFONO	SENNHEISER	SL CEILING MIC 2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
2c0fa9ae-8b5d-4548-8945-e7ed370dd973	\N	equipo	MICROFONO	SHURE	BLX1 H8E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
70a92e82-b54a-4204-bfc8-21e4c3bacbe6	\N	equipo	MICROFONO	SHURE	BLX2 S8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
9f047942-19c5-4724-99cb-4095e87fe829	\N	equipo	MICROFONO	SHURE	MX418 D/C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
9de5e925-8a48-40c1-8242-c53d1be70785	\N	equipo	MICROFONO	SHURE	PGX4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
33027412-a83b-4821-acc1-0826a880679d	\N	equipo	MICROFONO	SHURE	SR450	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
016b77f8-679f-4047-95c7-cb0bcc730e74	\N	equipo	MICROFONO/ALTAVOZ	YEALINK	CPE40	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
9b9c3871-4d25-4909-8ca8-f3b647c966cd	\N	equipo	PANEL TACTIL	AMX	MSD-431I	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
c871324b-25bf-453f-beea-c3f43f613afb	\N	equipo	PANEL TACTIL	EXTRON	TLP PRO 725M	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
8dfdc730-bc10-422c-b814-f43600d8f7b1	\N	equipo	PANEL TACTIL	EXTRON	TLP PRO 725T	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
ba91cb18-c793-43d5-9da5-b13250bcd963	\N	equipo	PANTALLA	NEC	E654	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
8a6f6631-fac9-4aa9-83b4-a14a6f2969b1	\N	equipo	PANTALLA	SAMSUNG	DM32D	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
3279cbb3-8f4b-46ed-befe-bfd9d4391860	\N	equipo	PANTALLA	SAMSUNG	DM82D	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
e96e1cbd-9b51-4029-a5ce-ad2dfeb65f96	\N	equipo	PANTALLA	SAMSUNG	LH65QBHPLGC/EN	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
36b7c054-6390-4d93-9ae3-863ca73b0d20	\N	equipo	PANTALLA DE PROYECCION	NP	NP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
485cc2e6-d680-4558-95e2-d7b00d84d1a1	\N	equipo	PANTALLA PROYECCION	INDETERMINADA	P PROYECCION	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
02063ee2-509b-4417-86a1-5af06ddb0a89	\N	equipo	PASARELA MODULO RELE	CRESTRON	CEN-IO-RY-104	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
ba2ecd84-f7c4-492c-b8df-2f28f26bb38e	\N	equipo	PASARELA RELE	CRESTRON	CEN-IO-RY-104	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	t	2026-08-05 11:02:11.295603+00	\N	\N
efe57845-2892-4f94-9751-90c671009a6d	\N	equipo	PC	HP	600 G4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
6c99f6f5-1ea5-4b74-a002-3d96282377ef	\N	equipo	PC	LENOVO	M93P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
f17c9202-a389-46ad-99cf-f37f134a2fd2	\N	equipo	PROCESADOR AUDIO	BIAMP	TESIRAFORTÉ AVB CI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
830cd48e-36f9-48fc-8a3c-0dc54f6fc44b	\N	equipo	PROYECTOR	EPSON	EB-1915	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
a415c6c7-a30a-43ba-9a6e-54e4fd9735e1	\N	equipo	RATON	LOGITECH	PERFORMANCE MX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
682cd7b2-868b-4bae-aed0-fb1ea9dd5b76	\N	equipo	RATON INALAMBRICO	LOGITECH	NP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
aad28f35-6988-48bd-8ddf-cb963c5d2017	\N	equipo	RECEPTOR HDBASET	CRESTRON	HD-RXC-4KZ-101	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
8f8f9377-79b2-4e4a-bb17-48a230f3beba	\N	equipo	RECEPTOR MICROFONIA	SHURE	SLXD1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
37fe2596-83c1-4ee9-8471-5de9f4f61e6a	\N	equipo	RECEPTOR MICROFONIA	SHURE	SLXD4D	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
8dd21adb-7af4-468e-9ff8-a11143434e15	\N	equipo	RECEPTOR MICROFONO	SENNHEISER	EM-2050	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
ea8d0029-0811-4985-8aa9-c5ddd920fbfe	\N	equipo	RECEPTOR MICROFONO	SHURE	BLX1288/W85 COMBO S8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
ace7a128-801a-46f5-8aea-3f6ca3bdb21e	\N	equipo	SELECTOR	KRAMER	DIP-31	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
41cdf22e-5fa8-44a3-9e76-b58ea72f1ab2	\N	equipo	SOPORTE	INDETERMINADA	SOPORTE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
7a1519c2-5dbc-4aa9-8532-0ec3281b54fb	\N	equipo	SOPORTE ALTAVOCES	GENELEC	8000-422W	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
0b46701a-0db0-4ad6-bb67-fb29ed9f4955	\N	equipo	SOPORTE PANTALLA	VOGELS	PFW4510	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
d9dd9369-a365-4105-955d-c6b465a321dd	\N	equipo	SOPORTE PARED	B.MONJE	BM-SLCDRM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
eff8ae17-a305-4189-b5f2-2967645e9e31	\N	equipo	SOPORTE PARED	BMONJE	BMSLCDRM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
9ff1f877-887e-4f2a-b5c1-8d574fe6f87b	\N	equipo	SWITCH	TP-LINK	TL-SG1005LP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
3a414b2c-4ec4-474e-b0a1-7d3edeb6c99b	\N	equipo	TECLADO	LOGITECH	K400	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
5a4a6876-4205-4983-b4ca-0ed5d96e9c29	\N	equipo	TOTEM	INDETERMINADA	CON RUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
732286e8-ccb0-48b5-bb00-c70be4f8315a	\N	equipo	TOTEM	INDETERMINADA	CONRUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	t	2026-08-05 11:02:11.295603+00	\N	\N
08b0d3b6-c530-4ef0-9713-0182c3e36667	\N	equipo	TOTEM	VOGEL'S	FD 2064 S TOTEM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
c65ee6f1-4772-441c-8c7f-12895d53bd02	\N	equipo	TOTEM PANTALLA	DIMASA	CONRUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
0feca3c9-b134-4f46-8a12-942f60b573ac	\N	equipo	TOTEM PANTALLA	TRAULUX	CONRUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
2270080b-145c-4c17-9c88-c527575b4a4c	\N	equipo	TOTEM PANTALLA	VOGELS	CONRUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
5ddd4cb4-d8ad-4bae-b0b6-1ac8c5db79ea	\N	equipo	TRANSMISOR MICROFONIA	SHURE	SLXD2/SM58	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
0936f932-8431-4407-9a5c-87a9c8c8b2ee	\N	equipo	TRANSMISOR VIDEO	CRESTRON	DM-NVX-351	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
35dd736f-4ab8-412e-b1bd-10081ed15ef0	\N	equipo	TRANSMISOR VIDEO	CRESTRON	DM-NVX-360	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
4fac2f8c-cca6-4b4e-900d-ba2fd0b88af2	\N	equipo	TRANSMISOR VIDEO	EXTRON	DTP HDMI 4K 230 RX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
96cb49ff-1e15-4bd7-9b9d-a74629547f0d	\N	equipo	TRANSMISOR VIDEO	EXTRON	DTP T USW 233	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
d4f0050c-769b-4de6-ba20-9aab0fbc21f0	\N	equipo	UNIDAD CONTROL MICROFONIA	BOSCH	DCN-CCUB	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
e3de2f82-442e-49cb-8107-fa34984103ee	\N	equipo	VIDEOCONFERENCIA	CISCO	EQ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
3c5d5ef0-f1d7-44b6-8117-b348bcdadb4b	\N	equipo	VIDEOCONFERENCIA	CISCO	SX20	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
f28a9f26-9ea7-410d-9702-f9d2aab671e9	\N	equipo	VIDEOCONFERENCIA	CISCO	WEBEX BOARD 70	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
f8848637-99a5-435e-b0c8-9f21205dfda2	\N	equipo	VIDEOCONFERENCIA	CISCO	WEBEX ROOM BAR	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
715339f9-aae3-408d-8d0f-4e83a9a2086e	\N	equipo	WIRELESS DISPLAY	MICROSOFT	1733.0	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
b0a6f616-cbe8-451d-b74b-d55cdc19ba2f	\N	equipo	↳TARJETA DANTE	SHURE	MXA 920W-S-60	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
a9765b60-d67f-4957-b5ba-7e4fd2019ef1	\N	equipo	ALTAVOCES	GENELEC	4410A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
9e6a55ce-d948-4f24-8def-edccf904e836	\N	equipo	ALTAVOCES	THOMANN	EV EVID 4.2 BLACK	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
d69d0524-56ff-4686-9c75-4cf75bcac097	\N	equipo	ALTAVOZ	EXTRON	SI26X	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
adf37c13-b614-49c2-b976-7d0f2b2bc145	\N	equipo	ALTAVOZ	GENELEC	4010 WM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
3e2ed0e3-bbb5-44ac-bf5a-d84f1ac7c016	\N	equipo	ALTAVOZ	GENELEC	4010A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
ac8fe248-c609-42a2-93ba-9957606967fa	\N	equipo	ALTAVOZ	GENELEC	4020AW	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
82d91150-72bb-4a35-8fe7-7ad0f17e58c0	\N	equipo	ALTAVOZ	GENELEC	4410 DANTE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
efa1feb5-6c19-4a6e-b5e4-3713d3b76354	\N	equipo	ALTAVOZ	GENELEC WHITE	4020C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
4f1c3996-45ed-4679-8268-711664135b18	\N	equipo	ALTAVOZ	PANPHONICS	PANPHONICS SSHA120X20	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
afae473a-bb30-4189-ba61-f7f66288c555	\N	equipo	ALTAVOZ	XILICA	SONIA -C5	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
0acb3f01-6bcd-41a5-9a02-565b5441cdfc	\N	equipo	ALTAVOZ	XILICA	SONIA C-5	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
20e3bfc8-3c1d-450e-b163-6d85eb96412e	\N	equipo	AMPLIFICADOR	APART	MA125	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
bc9d8129-0a94-4316-bf30-0a022ce0a38c	\N	equipo	AMPLIFICADOR	BOSE	1600SERIEVI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
946c274d-0ab3-4273-b484-8558447c1d1e	\N	equipo	AMPLIFICADOR	BOSE	MA200	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
a7623aa9-98fc-42e9-8658-9c4843aff191	\N	equipo	AMPLIFICADOR - MEZCLADOR	AUSTRALIAN MONITOR	AMIS 120	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
7ecc302b-29ec-4d87-b480-b9f4c770d959	\N	equipo	AMPLIFICADOR MIC	N-AUDIO	MIC1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
fc9e2cd8-a07b-45e9-a783-7ba723bbb33e	\N	equipo	BARRA	AVER	VB342+	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
2dd4c54c-4ba3-4985-b55a-de3248b80d9b	\N	equipo	BARRA	CRESTON	UC-SB1-CAM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
dee7afb9-74bf-4bbf-9eef-830815d2befc	\N	equipo	CABLE C	CISCO	CAB-USBC-AC-9M	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
c00cf302-736e-42a1-9853-a1cffe4b4241	\N	equipo	CAMARA	AVER	CAM520 PRO3	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
671ea3b3-359e-461b-9b66-300f655a05e2	\N	equipo	CAPTURADORA VIDEO	ELGATO	CAM LINK 4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
b491869d-899d-4cff-a1e2-71d979d1d75a	\N	equipo	COLUMNA FON DLI-130 DANTE	FOHHN	DLI-130	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
0038b3a3-cd30-4cb0-81be-516d93588b3c	\N	equipo	CONTROL AMPLIFICADORES	EXTRON	MDL, VCM100 AAP BLACK	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
45301b49-2660-4fa0-99e6-c81c3c7b4f3f	\N	equipo	CONTROLADORA	CRESTRON	CP4N	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
6099f912-2817-4939-aebd-56fa279493b4	\N	equipo	CONVERSOR	AUDINATE	AVIO-A-2OUT-EB	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
3ddab6fa-043b-49b0-9f29-e4f88733cfb2	\N	equipo	CAMARA	AVER	CAM520 PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
833b5215-d7b5-43f9-8e61-5fa5e10fc724	\N	equipo	CAMARA	AVER	CAM550	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
63cbb854-84d6-42d3-8afe-0c98bbe610da	\N	equipo	CAMARA	CISCO	CISCO PTZ 4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
1f05550a-7edf-4e62-840d-13a23b8e6646	\N	equipo	CAMARA	CISCO	EVI-X200C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
f8b2df67-e312-408f-b51a-0ebc654a2337	\N	equipo	CAMARA	CISCO	ROOM VISION PTZ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
cbd85845-c365-4f95-9355-f69a80dc274c	\N	equipo	CAMARA	YEALINK	A40-010	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
0d116593-80f6-48b5-be68-70519e6cce23	\N	equipo	DCN - EXPANSOR	BOSCH	DCN - TYPE LBB 4402/00	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
029cd1f4-8ea0-489f-9ac9-7d2e6944fe29	\N	equipo	DISTRIBUIDOR	BIAMP	TESIRA CONNECT TC-5	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
0436c356-030d-4405-a3bb-5b6d3e883779	\N	equipo	DISTRIBUIDOR	BOSCH	LBB4402/00	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
1b7cfc3f-1b00-47ea-911b-896ee88a282c	\N	equipo	DISTRIBUIDOR	EXTRON	DA2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
134d9ac6-87de-4a8b-8f95-7deb073258f9	\N	equipo	EMISOR HDBASET	CRESTRON	HD-TX-101-C-E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
e359b5f7-5f8a-4ab6-b8a7-d09d386297eb	\N	equipo	ESCALADOR	EXTRON	DVS 605A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
f8ff02ca-2354-4abe-9302-5dfd2c4662bc	\N	equipo	ESCALADOR	EXTRON	DVS-605	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
1e06992f-2cc1-4688-8b4d-db75f5e6ff07	\N	equipo	ESCALADOR	KRAMER	DIP-31M	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
95a47c7c-8a0d-4a2a-9e8a-404e0d9b10e8	\N	equipo	ESTACION DE CARGA DE ACOPLAMIENTO DOBLE PARA BATERIA DE IONES DE LITIO SB903	SHURE	SBC203	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
8d7b3689-ac7f-45ba-af0a-b0d6d4efaa9f	\N	equipo	ETAPA DE POTENCIA	MONITOR AUDIO	IA 60-12	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
a0b05b54-4119-424d-bb0f-6a421f5ac0d9	\N	equipo	ETAPA DE SONIDO	QSC	CX-Q 2K4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
7492e1f4-572c-4cca-ac71-cc1fa4f99604	\N	equipo	EXTENSOR	CRESTRON	HD-RXU-4KZ-101-E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
bd82bf57-8ad7-4357-98cd-74422bb2ef78	\N	equipo	EXTENSOR	CRESTRON	HD-TXU-4KZ-211-CHRG	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
92a16c78-fc9f-4bd6-ab9f-63aa84d86839	\N	equipo	FLIPCHART	SAMSUNG	WM55H	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
5c267bbe-3ed4-4e8b-8be0-0da5029fff73	\N	equipo	INTERFAZ AUDIO USB	BEHRINGER	UCA202	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
861b5284-eb83-41eb-9c7c-db190516d49b	\N	equipo	MATRIZ	EXTRON	DTP CROSSPOINT 108 4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
78113f64-2678-4b17-bfe7-647a4b8a6b11	\N	equipo	MEZCLADOR AUDIO	BIAMP	NEXIA VC	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
d99fb771-cbba-491a-aa7d-ac2988b191d6	\N	equipo	MICROFONIA	SHURE	MX396	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
657dc5e1-2cd4-4359-95fb-caa218573960	\N	equipo	MICROFONO	AVER	VC520 PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
825ad6f4-bfaf-4a16-8516-fcca7ee9d7b1	\N	equipo	MICROFONO	AVER	VC520PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
20380242-d6b7-44ca-9956-2fffe21e77c6	\N	equipo	MICROFONO	BIAMP	TESIRA PARLÉ TCM-X	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
9fcd0264-29e4-4bf7-80b6-9993b17cba43	\N	equipo	MICROFONO	CISCO	CEILING MICROPHONE PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
60e8910f-ccfa-45c3-b6f0-e3811d29d8e2	\N	equipo	MICROFONO	CISCO	CISCO TELEPRESENCE TABLE MICROPHONE 20	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
aca26ca0-7b0c-46b1-81a3-700d85611eb1	\N	equipo	MICROFONO	SENNHEISER	SK	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
802eff91-640b-41f9-bd5c-7a81682c7526	\N	equipo	MICROFONO	SENNHEISER	SK2000 516-558 MHZ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
0c5d93a0-f973-410d-9494-0b2ac71026ae	\N	equipo	MICROFONO	SENNHEISER	SKM-S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
c3a83b2e-6687-4bb2-bac6-081651d2a3d6	\N	equipo	MICROFONO	SENNHEISER	SKM2000 516-558 MHZ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
bdf82456-3a15-4dba-a065-c1e56b22150b	\N	equipo	MICROFONO	SHURE	BLX 1 HBE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
534ac651-d3ee-4aa7-8d36-8b0b249399fb	\N	equipo	MICROFONO	SHURE	BLX 1 S8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
d070c7aa-bfc1-4e4e-a22e-5ad8f3e64fc9	\N	equipo	MICROFONO	SHURE	BLX1288/W85 COMBO S8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
cf42dc14-ea3f-43a9-9095-663bf4011cec	\N	equipo	MICROFONO	SHURE	BLX24R/SM58	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
1855880a-e058-4c49-859d-0f4ade41d307	\N	equipo	MICROFONO	SHURE	BLX288/PG58-H8E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
7fd440f8-ccd5-415e-923d-566c68cb16b6	\N	equipo	MICROFONO	SHURE	BLX4R H8E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
ec4bbbbe-362d-4b8a-8eda-0ac1be11a6cd	\N	equipo	MICROFONO	SHURE	MX920-S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
4b3e180b-c80a-4b6d-adeb-e59a4cb472dd	\N	equipo	MICROFONO	SHURE	MXA920	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
470b6f75-a474-4e7b-9839-73cb9f768bfc	\N	equipo	MICROFONO	SHURE	MXA920 SQUARE ROUND BLANCO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
c587e340-fba2-4e80-a40c-f244e841db53	\N	equipo	MICROFONO	SHURE	PG58	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
2fa6016b-c750-4c7d-8089-e356db900892	\N	equipo	MICROFONO MESA	SHURE	MIX 396/C TRI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
805e6e3e-2b78-42d7-9645-58a550b5988f	\N	equipo	MONITOR	NEWLINE	FLEX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
d4a0d6c8-66e1-422f-b93c-6e382c7ccbad	\N	equipo	MONITOR	NEWLINE	TT-2721	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
a84cdf19-bfd8-4fb3-adf5-388577c68f07	\N	equipo	MONITOR	NEWLINE	X7	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
f45b984c-e72d-4273-bba7-8e3888012c43	\N	equipo	MONITOR	SAMSUNG	QB65R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
c55d7359-9ce3-421a-b2f2-de9aa71995e4	\N	equipo	MONITOR	SAMSUNG	QM55C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
ee1a2ee3-d3f1-46bd-86a6-3f1e590a0aab	\N	equipo	MONITOR	SAMSUNG	QMC43C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
92f4d6f8-f04c-4055-8d3a-612cd11e3056	\N	equipo	PANEL CISCO	CISCO	CISCO TOUCH 10	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
38d99341-d224-4b7d-bcee-716397b10095	\N	equipo	PANEL TACTIL	CRESTRON	ST 1700C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
3b2296ac-fc2c-45be-925f-7d858845053f	\N	equipo	PANEL TACTIL	CRESTRON	TSW-1070-B-S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
c7a1e80a-f9db-49af-8cb3-fc7290306168	\N	equipo	PANTALLA	NEWLINE	X7	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
bb0c0754-d1b1-428c-9a6b-9ec5e4d2b2ee	\N	equipo	PANTALLA	PHILIPS	55BDL3050Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
8445e883-56d3-4a68-91a4-9a7ffe879d11	\N	equipo	PANTALLA	PHILIPS	70BFL2214	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
e6be5856-fdb4-40f2-8231-6ffefaa37d41	\N	equipo	PANTALLA	PHILLIPS	55BDL3050Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
56602675-654d-4f90-ab32-2756c3023ec8	\N	equipo	PANTALLA	PIONEER	KRP-600M	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
252bf653-d73a-490f-adb6-4fe6836c5989	\N	equipo	PANTALLA	SAMSUNG	"65"""	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
fc776df3-d0c9-48d4-a81c-b5db0c9b7192	\N	equipo	PANTALLA	SAMSUNG	LH55DME	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
bea8e9c5-db8b-4206-b23f-3d19d984982c	\N	equipo	PANTALLA	SAMSUNG	LH65QBREBGCXEN	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
31e96fb1-02cf-4c4d-ae26-692d44467a39	\N	equipo	PANTALLA	SAMSUNG	LH85QMNE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
7df0a107-0d6a-44a9-b043-08e393be9eca	\N	equipo	PANTALLA	SAMSUNG	QB50B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
dfbfa710-c92d-4981-825b-42d7a7562251	\N	equipo	PANTALLA	SAMSUNG	QB65	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
d37c4fa0-40d5-472a-a668-746cca4b86a8	\N	equipo	PANTALLA	SAMSUNG	QB65H	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
d06519c7-29d1-4db6-9ae6-ae0600dd2268	\N	equipo	PANTALLA	SONY	55XE8001	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
cd9f5d4c-1a2f-46e7-8ceb-5175eaad9bea	\N	equipo	PANTALLA	SONY	65XE8501	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
243304d1-ba99-4204-b577-5df1cbe73939	\N	equipo	PANTALLA	SONY	BRAVIA KDL-48W605B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
9cd0c412-5ac9-4d50-810f-24cea32b9160	\N	equipo	PANTALLA	SONY	FE-65XE8501	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
88a74e29-d33b-4f8a-893a-8f1a5c971a8d	\N	equipo	PANTALLA	SONY	KD-75XE9405	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
f4e2f92a-1230-48b4-ba82-4e94f9a49fd5	\N	equipo	PANTALLA	SONY	KDL-65HX920	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
05f52ea4-4ea1-489a-8a24-1a5f4853c348	\N	equipo	PANTALLA DE PROYECCION	BALTA	PE300-2WCB	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
4204b492-7c5b-4c2a-a157-1c6c78f920df	\N	equipo	PANTALLA DE PROYECCION	INDETERMINADA	P PROYECCION	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
342f024e-63d8-43f0-9a09-6ebef36f7991	\N	equipo	PANTALLA DE PROYECCION	INDETERMINADO	PROYECCION INDETERMINADO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
1a8e728f-dd09-440b-b3df-bab32fd6fde7	\N	equipo	PASADOR	LOGITECH	WIRELESS PRESENTER R400	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
58af65dc-864c-434a-8170-6490d8e51828	\N	equipo	PASARELA MODULO RELE	UNBRANDED	HHC-N8I8OP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
97585ae8-505d-4741-8ead-47073b89e9c7	\N	equipo	PC	HP	COMPAQ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
6a561b82-cd0e-4cce-b699-446481b9d999	\N	equipo	PC	HP	PRODESK 600G4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
7430c229-8923-4143-b3c3-74d429caeb6e	\N	equipo	PC	HP	PRODESK G4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
fc9cbf2e-29cc-4f6f-9b6b-b2472db2e911	\N	equipo	PC	LENOVO	8300.0	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
dff0d528-ec9d-47bf-9461-ccaca65505b6	\N	equipo	PC	LENOVO	920Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
cffbfa89-ad43-4849-aad5-4b3decfa547f	\N	equipo	PC	LENOVO	M910	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
864e6bf3-29a8-4760-b9eb-fe1d047602e4	\N	equipo	PLAYER CARTELERIA	BRIGHTSIGN	XD1034	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
2153570e-542d-40ec-918b-4bf50fc13204	\N	equipo	PROCESADOR AUDIO	BIAMP	TESIRA FORTE CI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
532bd93f-5d57-42e4-8ee0-b7376b8b524c	\N	equipo	PROCESADOR AUDIO	BIAMP	TESIRA FORTE DAN CI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
64251474-a4b1-4f5a-a6a3-9a875e415e76	\N	equipo	PROCESADOR DE AUDIO	BIAMP	FORTE AL	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
50e18c98-54e6-4011-b36b-6f88e276e1ab	\N	equipo	PROCESADOR DE AUDIO	BIAMP	NEXIA	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
665d8245-7103-4fe3-b972-6bb3c9b94885	\N	equipo	PROCESADOR DE AUDIO	BIAMP	TESIRAFORTÉ AVB CI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
a11b16a2-04eb-41e3-a2ba-17ae8d8ed115	\N	equipo	PROYECTOR	EPSON	EB-1955	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
0ef1fb39-de79-40bb-bae5-516db8901c92	\N	equipo	PROYECTOR	EPSON	EB-1980WU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
b0f5eebd-7476-496c-b614-4014d5470b6f	\N	equipo	PROYECTOR	EPSON	EB-G5600	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
54965ccc-0ba7-4d21-a8ef-9d45bd6ff12b	\N	equipo	PROYECTOR	EPSON	L630U	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
032b4689-76df-4877-a738-3b41a0b9fce9	\N	equipo	PROYECTOR	MITSUBISHI	XL1U	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
6c0ae0ca-e983-4d46-b1c3-bc11d5761d10	\N	equipo	PROYECTOR	MITSUBISHI	XL30U	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
9b2688d4-73b0-4bfa-a99f-08f7e60314a9	\N	equipo	PROYECTOR	PANASONIC	PTMZ670	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
2fb421f5-13e1-4774-b71c-448095886ce9	\N	equipo	PROYECTOR	SONY	VPL-FHZ65	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
c0217b96-7bf7-4308-8d6e-fdf901bf3bb2	\N	equipo	PULSADORES PANTALLAS	CRESTRON	DIN-8SW8-I	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
74f4f82c-2fda-4e32-82da-d4512d4381b2	\N	equipo	RACK HORIZONTAL SALAS VIDEOCONFERENCIA	ADVANTIS	PC14 - 10670	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
62a07bdc-7606-4db6-8770-204e940a3e12	\N	equipo	RATON	LOGITECH	MX MASTER	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
3d939582-0e14-41dc-a053-8547a144c49d	\N	equipo	RECEPTOR	CRESTRON	HD-RX-101-C-E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
316895f1-dc84-4b07-85ea-5204c0555f6c	\N	equipo	RECEPTOR DE VIDEO	MATROX	DM-NVX-D30	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
42ab4f4e-705a-4db5-a81a-2b7fa0d4235a	\N	equipo	RECEPTOR HDBASET	CRESTRON	HD-RX-4K-410-C-E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
08529025-d1a2-4edd-bade-a45ccee9a6cb	\N	equipo	RECEPTOR MICROFONIA	SHURE	BLX88 H8E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
d8b8f9b3-7313-40b2-8113-1d35d1e5803b	\N	equipo	RECEPTOR MICROFONO	SENNHEISER	EM2050 516-558 MHZ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
c489c106-5644-42b1-9cb2-6324a80ded0d	\N	equipo	RECEPTOR MICROFONO	SENNHEISER	EW-D EM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
154269c9-bc5c-41f2-a659-00a57dfe705a	\N	equipo	RECEPTOR MICROFONO	SHURE	BLX88	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
bffb3b29-9efa-4f30-8f84-1820f196b078	\N	equipo	RECEPTOR MICROFONO	SHURE	ULXP4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
25ecd02e-0a83-40c6-81b7-62356faa5184	\N	equipo	RECEPTOR VIDEO	CRESTRON	DM-NVX-E30	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
43a1787f-7eac-41c0-a5dd-8d61613295a9	\N	equipo	RECEPTOR VIDEO	CRESTRON	DM-NVX-D351	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
45ebee54-95a1-4e03-a62b-b0703b6c8f51	\N	equipo	REPRODUCTOR	BRIGHTSIGN	LS423	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
3170b8c5-e396-4bd7-a1c1-a62f5f957acd	\N	equipo	SELECTOR	KRAMER	DIP-31M	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
09aef592-198f-46a4-8e80-3e4b55f5e8d2	\N	equipo	SOPORTE	B-TECH AV MOUNTS	BT7052	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
d3a9c135-2ff5-4182-b0eb-53271ec381a5	\N	equipo	SOPORTE ALTAVOZ	GENELEC	8000-422W	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
fd0d529c-c721-40c5-a3fb-0440afc8a329	\N	equipo	SOPORTE PANTALLA	CHIEF	CM2L40UI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
cfad1f0b-acea-4cf5-aea2-4d4ebf3babad	\N	equipo	SOPORTE PANTALLA	HILTON	C2P2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
227143e3-fd48-4dbf-908e-1b761e5f3b6b	\N	equipo	SOPORTE PANTALLA	VOGELS	CONNECT IT TROLLEY	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
df940cfe-6669-4a49-abb8-713618a0421a	\N	equipo	SOPORTE PANTALLA	VOGELS	FD 2064 S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
a08bf11c-4b07-4bce-921d-be99d06d7107	\N	equipo	SOPORTE PARED	BMONJE	BM-SLCDRG	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
321b41cc-5687-4df8-b994-76df4862fc7a	\N	equipo	SOPORTE PARED	BMONJE	BM-SLCDRM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
eaf90817-bdf5-4a85-9963-d89a00892142	\N	equipo	SOPORTE PROYECTOR	VOGELS	PPC 1585	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
0de1056a-4412-4c62-b318-b3289aa228ec	\N	equipo	SUBWOOFER TECHO	MONITOR AUDIO	ICS-8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
4628f65c-43e4-4992-b086-6ff51d77d347	\N	equipo	SWITCH	EXTRON	DTP T DSW 4K 333	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
4d28b21f-de71-41d5-96b7-9edc9b5f04cc	\N	equipo	SWITCH	EXTRON	SW4 HD 4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
8d5f812c-ccc6-47b9-a3a0-f5bca519b6c1	\N	equipo	SWITCH	NETGEAR	GS308EPP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
65c5a667-fae9-4803-967b-6652751ac40b	\N	equipo	SWITCH POE	NETGEAR	GS305P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
b07c4b45-1978-433d-ab48-a3ae3ef46778	\N	equipo	TARJETA DANTE	EXTRON	EXTRON AXI 22 AT	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
f5865b23-c050-4de4-b70a-71c1ef6c4775	\N	equipo	TECLADO	LOGITECH	WIRELESS SOLAR K750	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
b12330bb-471a-4ab1-96fa-c3e0e5d977ad	\N	equipo	TECLADO Y RATON	LOGITECH	MK700/MK710	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
9ce0d33c-cfe8-4628-bcbb-c17b6a3ea5ce	\N	equipo	TECLADO/RATON	LOGITECH	MX 5500	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
edeb10ac-83a8-4b87-9f77-0a64d2db60f3	\N	equipo	TELEFONO IP	CISCO	CP-8831	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
64f69d56-0942-4b0e-b00b-a5968caf9ecc	\N	equipo	TOTEM PANTALLA	DIMASA	FLEX-R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
c4402b8e-0024-4ad9-b798-b67f241dd8ee	\N	equipo	TOTEM PANTALLA	INDETERMINADA	CONRUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
01670149-970c-4b85-b53d-4f7b736fef33	\N	equipo	TOTEM PANTALLA	INDETERMINADO	CON RUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
970c6b3e-fd1f-4bd1-b55c-fba86fac24c3	\N	equipo	TOTEM PANTALLA	STYLU	HILTON C2P2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
ba548413-8c27-4172-80e1-8f6218db361d	\N	equipo	TRANSMISOR AUDIO	JUST ADD POWER	VBS-HDIP705 POE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
34034aaf-f4e9-4683-9ced-01e3516fe596	\N	equipo	TRANSMISOR RADIADOR	BOSCH	INT-TX04	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
17c0008f-13a7-4327-bf13-8f068f63d184	\N	equipo	TRANSMISOR VIDEO	CRESTRON	DM-NVX-D30	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
5e22b2d4-5c59-4dba-8784-838db9210cb5	\N	equipo	TRANSMISOR VIDEO	CRESTRON	HD-TX-101-C-E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
a572be63-2ce2-4fb7-af1f-6a12d671e838	\N	equipo	TRANSMISOR VIDEO	EXTRON	DTP T DSW 4K 233	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
eb97637a-a9f4-44b3-8b2f-74d0640035a2	\N	equipo	TRANSMISOR VIDEO	GEFEN	TOOLBOX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
e3ae0047-b986-428b-ac9e-47058a8e01ea	\N	equipo	TOTEM	INDETERMINADO	CON RUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
70b740d3-f43c-4fc8-8d2e-54ee3bde6783	\N	equipo	TOTEM	INDETERMINADO	CONRUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	t	2026-08-05 11:02:11.295603+00	\N	\N
0d4d5ff7-e2de-4e78-b1f0-70e33a940689	\N	equipo	UNIDAD CONTROL MICROFONIA	DICENTIS	DCNM-WAP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
a039db10-0f56-4c77-afb0-973c1a573424	\N	equipo	VIDEOCONFERENCIA	AVER	VC520PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
efac68f6-9683-455b-8e04-812e18370511	\N	equipo	VIDEOCONFERENCIA	CISCO	BOARD 70	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
e61f868a-1ea4-4c12-81da-83538fb72e7c	\N	equipo	VIDEOCONFERENCIA	CISCO	CISCO ROOM KIT EQ	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
11263d6c-3a82-434b-9b3a-1784969e04fd	\N	equipo	VIDEOCONFERENCIA	CISCO	CS-DESK-K9	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
e56d53f5-1903-4f8a-a7e8-9d17014e6b78	\N	equipo	VIDEOCONFERENCIA	CISCO	MINI SPARK ROOM KIT	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
236b70f4-92d0-4fb9-a035-89bdc61dab1d	\N	equipo	VIDEOCONFERENCIA	CISCO	ROOM KIT	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
e0c1bb51-5a0e-47d5-baca-abdc37dbc0f9	\N	equipo	VIDEOCONFERENCIA	CISCO	WEBEX BOARD PRO 55	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	t	2026-08-05 11:02:11.295603+00	\N	\N
27c4ab56-fdd5-4ba0-8aca-61bf8fce3b66	\N	equipo	ALTAVOCES	BOSE	LIFESTYLE N123	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f6f2b968-22fd-4ac2-9d94-5e16dfef5b53	\N	equipo	ALTAVOCES	GENELEC	4010AM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8c0fbcaf-d593-47c2-b65f-7c1b539fa2c2	\N	equipo	ALTAVOCES	GENELEC	4020C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
79934181-7371-44e9-b04a-514dc45766c4	\N	equipo	ALTAVOCES	GENELEC	8000-444B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
64ac79f3-5148-4c82-9ffb-3689ae4cfb68	\N	equipo	ALTAVOCES	GENIUS	PT	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a0c4aef6-3847-4109-a575-2a088e425585	\N	equipo	ALTAVOCES	HERCULES	XPS 2.0 35 USB	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9d41e3a1-ea40-4298-a73d-7e72060dba59	\N	equipo	ALTAVOCES (X14)	SONY	INACCESIBLE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2b3f79a4-5180-4a38-a8da-044048dc7d22	\N	equipo	ALTAVOCES (X2)	BOSE	INACCESIBLE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
59149d0f-346e-4f54-bca0-63478cfedac5	\N	equipo	ALTAVOZ	LOGITECH	886-000056	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b7279445-73a7-4cc7-96dd-a305eb1fd216	\N	equipo	ALTAVOZ	PANPHONICS	AA-160	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
fc34558c-b5d2-437c-a485-5b43403acda8	\N	equipo	ALTAVOZ	YAMAHA	MS101-4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3ecae8ba-035b-40ec-8260-c120ef05cd1f	\N	equipo	AMINO	NEMKO	H140	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
940306a7-e817-4999-bd50-f622fdacee95	\N	equipo	AMPLIFICADOR	AMPETRONIC	C10 -1 N	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bc8ca4f8-cda3-4b02-876e-c7653fa807ef	\N	equipo	AMPLIFICADOR	BITTNER	BASIC 800	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1ba0cd67-7796-4815-bb18-5da195af5aaa	\N	equipo	AMPLIFICADOR	BOSE	2150.0	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c4f4c241-87c9-440d-a894-dfbb8c55234c	\N	equipo	AMPLIFICADOR	CAMCO	VORTEX 2.6	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
482c1072-15e6-46f9-9308-8ace65fd3f7a	\N	equipo	AMPLIFICADOR	CREST	CPX-1500	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3538abad-ab84-4d65-83fc-9a98ca2f8556	\N	equipo	AMPLIFICADOR	CROWN	CTS 1200	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f50e85dd-0b34-499f-a702-1daceae1b073	\N	equipo	AMPLIFICADOR	EAW	CAZ800	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e96d103e-eb3d-4e0b-a8fe-d2f33d415560	\N	equipo	AMPLIFICADOR	EXTRON	DTP HD DA8 4K 230	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e99a035c-193f-4a73-94f6-8e1a2a888799	\N	equipo	AMPLIFICADOR	EXTRON	MPA 122 MINI POWER AMPLIFIER	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b8f84c48-3584-47ed-bf84-54f5e5b45fd5	\N	equipo	AMPLIFICADOR	XILICA	SONIA AMP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a37a44aa-bc00-4a89-ba68-8767532b3b10	\N	equipo	AMPLIFICADOR	XILICA	SONIA-AMP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
21d290e3-b67b-4ff9-8309-f3d4f4935bd4	\N	equipo	AMPLIFICADOR DANTE	PANPHONICS	AA-160	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f2d446a1-14d0-4040-99e0-6e622deabfa3	\N	equipo	AMPLIFICADOR MIC	N-AUDIO	MIC-1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b6856374-627d-4ab6-9593-925bf63670cb	\N	equipo	ANTENA	SHURE	BLX88 S8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
907382fd-2da5-4210-b0c8-c3eb5e068085	\N	equipo	ANTENA UA8 SHURE	SHURE	UA8-518-598	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ff3ca7e2-afd1-4a51-bf97-7f8b383783db	\N	equipo	APPLE TV	APPLE	3ªGEN	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9bc362a5-77e3-4083-b24e-81d5708c12f4	\N	equipo	AUDIOCONFERENCIA	CISCO	CP-8831	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
37c71bcb-3b4e-430e-974f-294e32bb1111	\N	equipo	AUDIOCONFERENCIA	POLYCOM	SOUNDSTATION2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
58f6b03a-e827-4e14-8074-a904fb35f11e	\N	equipo	BARRA	CRESTON	US-CB- 1CAM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4ed860a9-0f27-4c64-a30c-909715de5e80	\N	equipo	BARRA CISCO	CISCO	QUAD CAMERA	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d69a0ced-f23f-4f6f-93df-ef062b66cb3d	\N	equipo	BARRA DE VIDEO	YEALINK	MEETING BAR A30	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
14a955e7-7373-4b85-9ec5-ee561b0d58ea	\N	equipo	BARRA SONIDO	POLKAUDIO	SURROUNDBAR3000	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
67a75230-37f8-431a-8873-71dab871dd07	\N	equipo	BARRA USB VIDEOCONFERENCIA	AVER	VB342	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0799306c-80cf-4cca-bb3c-3b9c8a500fc6	\N	equipo	BARRA VIDEOCONFERENCIA	AVER	VC520+	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f14c65fe-b93f-44c8-9644-3c5643c51c00	\N	equipo	BARRA VIDEOCONFERENCIA	AVER	VC520PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
32882170-3a63-4474-b6d9-5bf3ea99e304	\N	equipo	BARRA VIDEOCONFERENCIA	JABRA	PANACAST 50	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5cb96267-37d1-4f93-bfaa-dc6142aa0a03	\N	equipo	BARRA VIDEOCONFERENCIA	YEALINK	A20-010	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
61cac7f5-242c-44a2-b4fc-469ce75929e7	\N	equipo	BARRA VIDEOCONFERENCIA USB	YEALINK	MEETINGBAR A30	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8d61fae8-2783-447f-82af-48403cd66ddd	\N	equipo	BASE MICRO INALAMBRICO	YEALIMK	CDW90	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
93ab3272-cd02-48d4-b435-98ec3c86d31b	\N	equipo	BOTONERA	EXTRON	CABLE CUBBY 1202	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b79785b9-7cb5-4ea4-880b-7084552dba19	\N	equipo	CAJA ACUSTICA	SOUNDTUBE	RS500I	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f128045d-14f8-4acc-90f8-e3341188fa59	\N	equipo	CAJAS ACUSTICAS	GENELEC	4010AW-6	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
54d45583-5f0e-48fb-80cd-3c7fadd35362	\N	equipo	CAM	LOGITECH	C-U0036	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
749fd6fe-e286-44e8-8635-2d25723bdc8d	\N	equipo	CAMARA	AVER	VB 342+	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2cfd0a3a-da2d-42a6-9796-5a4ff02a145e	\N	equipo	CAMARA	LOGITECH	C-U0036	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
28df7cb0-e3aa-427b-8f30-a61df1c8f365	\N	equipo	CAPTURADORA	BLACKMAGIC	ULTRASTUDIO 4K MINI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0502c51a-f203-40a9-8e58-3b73978c2870	\N	equipo	CAPTURADORA PANTALLA	KAPTIVO	WALL MOUNT CAMARA	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
cd0d61db-7796-445f-9c64-7d0cfb81dedb	\N	equipo	CD MULTICOMP	PIONEER	PD-M426	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ff0300aa-8731-411a-958b-9138de49fb6c	\N	equipo	CONMUTADOR 2/1 VGA	EXTRON	P/2 DA2XI MT	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
395db492-fc31-4149-8099-171d6e2e922b	\N	equipo	CONTROL PROCESOR	CRESTON	PRO 2 PROFESSIONAL RACK2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1419c0db-a244-4db4-b7bc-1ddccefc8af6	\N	equipo	CONTROLADORA	AMX	NI-700	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8232850a-be5b-4e33-b9e7-bdd54e1d7e97	\N	equipo	CONTROLADORA	AMX	NX-1200	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a9a30fa9-3685-4237-b058-8dfb4bf6255c	\N	equipo	CONTROLADORA	CRESTRON	CP-3	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5d05e6ff-00c1-4f52-b757-a87e376ae435	\N	equipo	CONTROLADORA	CRESTRON	CP4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
548714f4-e2a3-4dda-b2fc-4d4d9d74a969	\N	equipo	CONTROLADORA	CRESTRON	CP4-N	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a3879ab7-cabf-4736-b0dc-cf8e11226259	\N	equipo	CONTROLADORA	DATAPATH	HX4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9bd187cc-8e0b-46fe-bdf5-5699fabc2312	\N	equipo	CONTROLADORA	EXTRON	IPCP 250 PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d2b7be8e-46fc-436f-8599-d9e32102024f	\N	equipo	CONTROLADORA	EXTRON	IPCP PRO 250 1843	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
15b43fa6-1191-481b-a4d0-273ea28ac0d6	\N	equipo	CONTROLADORA	EXTRON	IPCP PRO 550	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5b1b5f1d-cf9a-4f78-bce0-d3a10462eaa9	\N	equipo	CONTROLADORA	EXTRON	IPCP PRO250	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7aa4301a-3092-4b5a-bc1d-613152d394a1	\N	equipo	CONTROLADORA	LG	CVBA	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5e9eb07d-425a-43b1-999a-b30e6b3572d7	\N	equipo	CONTROLADORA	NOVASTAR	VX600	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2511b61a-cd0a-44d5-a34c-a4ee751ab236	\N	equipo	CONTROLADORA VIDEOWALL	NOVASTAR	VX400	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2e365031-6807-481d-81fd-5bd1c8958c31	\N	equipo	CONTROLADORA VW	DATAPATH	VSN1172	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b3716fe2-d4c4-4c6e-94fb-a21e3c4f6ac7	\N	equipo	CONVERSOR	BEHRINGER	ULTRAGAIN PRO-8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6f72f306-59dd-4913-9f7c-40caded45752	\N	equipo	CONVERSOR	EXTRON	DTP HDMI 230TX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a7fd3bb9-b8c9-433d-b4f5-eccc50cc89fc	\N	equipo	CONVERSOR	INOGENI	U-CAM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
cfc37f9d-09cb-414d-bbff-7693b46c87b5	\N	equipo	CONVERSOR	KAPTIVO	KW100	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1719bd04-c074-4cc9-977d-b5584c7b6767	\N	equipo	CONVERSOR HDMI USBC	YEALINK	VCH51	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4efff07e-0c01-4ee8-82d9-a24729bda4c8	\N	equipo	CAMARA	AVER	342+	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c6f293a8-1fe1-4a0c-9267-6590b4b0c307	\N	equipo	CAMARA	AVER	520PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
574bb223-b8de-46b0-a161-f42a7e00e39c	\N	equipo	CAMARA	AVER	CAM520 PRO 3	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6226054c-24e1-4080-9f0c-7331c2c6d9de	\N	equipo	CAMARA	AVER	CAM520 PRO POE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e61ba6f6-1e8c-42c5-a2cf-788f09e8803b	\N	equipo	CAMARA	AVER	P0-A5-AVER	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1b782990-622a-4af6-b25a-73f6d8f9dadd	\N	equipo	CAMARA	AVER	PTC 500S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6d10ef6f-a236-4494-ad06-1d76c060aaa9	\N	equipo	CAMARA	AVER	PTC500S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8cfe98e0-a814-41e0-a715-eb0698cda091	\N	equipo	CAMARA	AVER	PTZ 330	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
fe376074-4cbb-4288-bc48-1c78f9ba141c	\N	equipo	CAMARA	AVER	VC520 PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
258b2ab4-86e7-4334-99e2-6fcc71df0223	\N	equipo	CAMARA	AVER CONFERENCE	VC520	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f580590a-16b0-402f-ad29-fe794de5db6e	\N	equipo	CAMARA	CANON	CR-N100	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8ba007f9-d557-459a-a1e9-e6892a42dc41	\N	equipo	CAMARA	CISCO	CISCO P60	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
11d6503f-d439-4f94-890e-60ad12e0e563	\N	equipo	CAMARA	CISCO	CISCO PTZ-4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bad2323c-944e-4339-848c-3a8832382bb3	\N	equipo	CAMARA	CISCO	CISCO QUAD CAMERA	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
897eec41-6a42-49e0-99aa-44386ebb6bee	\N	equipo	CAMARA	CISCO	PRECISION HD 1080P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9c408787-8402-4088-afd1-80c42048fc1d	\N	equipo	CAMARA	CISCO	TTC8-02	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b2fb3e84-6e56-4cc3-816f-1adc9031685a	\N	equipo	CAMARA	LOGITECH	LOGITECH GRUOP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
539bf2b9-6339-4a21-9c7b-fdc077470878	\N	equipo	CAMARA	YEALINK	UVC85	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7effa850-1a0b-47f5-95ac-0667ff82b1d2	\N	equipo	CAMARA IP	AVER	CAM 550	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
66482b74-404a-4064-a9f2-0ccf85196d4c	\N	equipo	DCN	BOSCH	BOSCH INT-TX08	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e17ef3cb-83e3-42d3-990d-118f6fcc0ae6	\N	equipo	DCN - INFRARROJOS	BOSCH	DCN INT TX08	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5adc7cc0-6e60-4973-983b-3183ebf03409	\N	equipo	DIGITAL SYSTEMCONVERSION	SAMSUNG	SV-5000W	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
74676739-15aa-4f7c-ac0e-4db22b3b2b1c	\N	equipo	DISTRIBUIDOR	CRESTRON	HD-DA4-4KZ-E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b84da0ec-d79e-4eb6-821f-99a95bb4d7f0	\N	equipo	DISTRIBUIDOR	CRESTRON	HDPS-402	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
78aaf6d4-6b3d-4126-980e-c9948d62609c	\N	equipo	DISTRIBUIDOR	EXTRON	DA4 HD 4K PLUS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9493ba12-1026-440d-aa01-2c68d7652dae	\N	equipo	DISTRIBUIDOR	EXTRON	DTP HDMI 230 TX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e4a70527-004b-4c57-9f48-7379521a7a14	\N	equipo	DISTRIBUIDOR	EXTRON	DTP T DSW 4K 233	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
24158144-9a3f-46b2-ad85-d2bd93d43565	\N	equipo	DISTRIBUIDOR	EXTRON	SW4 DVI A PLUS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ab81713b-c205-4621-a280-e4de726b630a	\N	equipo	DISTRIBUIDOR	EXTRON	SW4 HD 4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c731d258-9bae-4a2c-b135-93fe82aa0350	\N	equipo	DISTRIBUIDOR	KRAMER	DIP-31	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f3f7cffb-1fdb-4023-89a7-7073adbc9e80	\N	equipo	DISTRIBUIDOR	SHURE	UA884SWB	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bfb33371-c7b6-49aa-a276-a1f49068c6fc	\N	equipo	DISTRIBUIDOR HDMI	EXTRON	HDMI D6	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a9a4164e-edda-40a6-864b-e553b5284808	\N	equipo	DISTRIBUIDOR HDMI	EXTRON	HDMI DA2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5aa278b1-1371-405a-af4b-d8f7f59a96a4	\N	equipo	DISTRIBUIDOR VIDEO	CRESTRON	HD DA4 4KZ E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1fe75a37-9503-491d-9f6f-66bd899a5b75	\N	equipo	DISTRIBUIDOR VIDEO	EXTRON	DTP HD DA8 230	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f62758e5-79f6-41fd-9382-6de2382daa17	\N	equipo	DISTRIBUIDOR VIDEO	KRAMER	VM-2HXL	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
35690a6b-f254-4435-afc3-d85cd4021537	\N	equipo	DOCKING STATION	TARGUS	DOCK192	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8e558c3d-d110-431d-99fc-d76ff054e3f5	\N	equipo	DOCKSTATION	TARGUS	DOCK180	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
46c248b9-629c-4adc-9e7e-5774ae651436	\N	equipo	DONGLE MSDISPLAY	MICROSOFT	WIRELESS DISPLAY ADAPTER	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
aa3b472d-0bb6-42dd-8e61-a7b2776b0f7a	\N	equipo	DONGLE MSDISPLAY	MICROSOFT	WIRELESS DISPLAY ADAPTER NUEVO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7d1ea315-11d9-4589-a4e6-f479befe008a	\N	equipo	DSP	BIAMP	FORTÉ DAN VT4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a29d2bda-ded9-4312-b347-deade7fa3b14	\N	equipo	DSP	Q-SYS	FLEX 8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2322b147-7afe-40fa-a824-9d2aa613eec5	\N	equipo	DSP	TESIRA	TESIRA 12*8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
932aea6c-4562-4006-8f12-c3a645d4b5a9	\N	equipo	DSP AUDIO	BIAMP	TESIRA FORTÉ AI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a5d02cbe-85cf-4082-a369-0c5834847981	\N	equipo	DSP AUDIO	CRESTRON	DSP-1283	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5c85c34f-208f-4714-9517-fc3ebd4027b1	\N	equipo	DVC PRO	PANASONIC	AJ-D250	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4bd3d48b-138f-4301-9095-fb07bb780dc0	\N	equipo	DVD	JVC	XV-N316	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bd0b113f-f2bb-4e63-ab3c-af0c11035535	\N	equipo	DVD	PIONNER	DV-340	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
057055d0-7493-4485-b3c1-b2f0e849e034	\N	equipo	DVS	EXTRON	DVS 605	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0d32431a-e11b-42b4-b85d-a5d3c41b2b0f	\N	equipo	EMBEBEDOR/DESEMBEBEDOR AUDIO	BLUESTREAM	HD11AU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6f830dde-35d7-4c64-a9c9-9eed3878d51c	\N	equipo	EMBEBEDOR/DESESMBEBEDOR AUDIO	BLUESTREAM	HD11AU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c1b00938-5fb9-4a13-b860-7a2037298e9b	\N	equipo	EMISOR HDBASET	EXTRON	DTP HDMI 230 TX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a7789f89-1fa8-40aa-8259-85f9412aea0f	\N	equipo	EMISOR HDBASET	STC	RC5-CE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
cffaa68e-4c49-4880-948a-b957e2e4439e	\N	equipo	EMISOR USB	BLACK BOX	IC408A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c852014d-88ef-4b03-a511-442f1b2e3122	\N	equipo	EMISOR VIDEO	CRESTRON	DM-NVX-360	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7d639c25-07eb-4547-9009-501038ffb392	\N	equipo	EMISOR VIDEO	CRESTRON	DM-NVX-D30	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3fb7448a-70e7-40d9-adec-c81f19c055e9	\N	equipo	ESCALADOR	CRESTRON	HD-PS402	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e163792b-bfd2-4da6-8f05-cc43286c3913	\N	equipo	ESCALADOR	EXTRON	605.0	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d1294e14-34ae-4b52-81fb-134fc41847ba	\N	equipo	ESCALADOR	EXTRON	IN 1608XI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bc2120e2-d1c0-41df-8107-be428ef44735	\N	equipo	ESCALADOR	EXTRON	IN1606	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
698a3890-eb3e-46d1-804f-dbf829517a22	\N	equipo	ESCALADOR	EXTRON	IN1608XI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5b011164-042d-41e4-a7bf-359863101306	\N	equipo	ESCALADOR	KRAMER	VP-440X	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2d1216bd-5619-42cb-a9c5-4c3f1b49b704	\N	equipo	ESCALADOR	KRAMER	VP-461	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
817dd4c1-6e45-4a74-8c18-07c881023b48	\N	equipo	ESCALADOR	KRAMER	VS 211XS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8c695211-0d55-4133-98fb-4cadabdaa41b	\N	equipo	ESCALADOR ANEXO AUDITORIO	EXTRON	DVS 605A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d7789bc5-9044-4408-8203-55fa011f17d0	\N	equipo	ESCALADORA	EXTRON	IN1606	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
626a0778-5c58-4115-97a5-9514f42bf33b	\N	equipo	ETAPA DE POTENCIA	CRESTON	CPX 1500	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a04b3e8f-0132-4cb3-9966-fb8a5bc9c14a	\N	equipo	ETAPA DE POTENCIA	CROWN	XLI 800	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
649ffa12-cc4d-4baa-a46e-08f10e476957	\N	equipo	ETAPA DE POTENCIA	LDA	MAP6-100	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
756c2a63-f30d-4a59-b669-12d6898f14a0	\N	equipo	ETAPA DE POTENCIA	RCS	BA - 120C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f92d07e8-0d2f-42a2-8af4-e9774296ef6a	\N	equipo	ETAPA POTENCIA	CREST	CPX 900	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
67aed3ba-e7a0-4b55-8d8b-40d7c848aa9c	\N	equipo	EXPANSION MICROFONO	AVER	VC520	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
eeaa14cd-e42c-43b3-a03f-671752bfc12d	\N	equipo	EXPANSOR	AMX	AMX EXB-COM2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
25e97cb9-2821-40c5-afa5-d49574029df9	\N	equipo	EXTENSOR	ATEN	UE3310	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3051b791-e20a-404f-b491-7b7ff21450cd	\N	equipo	EXTENSOR	GEFEN	EXT-DVI-1CAT5-SR-CO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4872b808-f632-4cb3-aa48-ed8de321d698	\N	equipo	EXTENSOR	GEFEN	EXTENDER FOR HDMI DTV S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
632db4a3-7943-4ecc-82cf-9ea66a6d1e8a	\N	equipo	EXTENSOR BYOD	YEALINK	MVC	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8bb2d4e5-9197-4e7c-967d-021b546fda99	\N	equipo	EXTENSOR VIDEO	EXTRON	TX DTP3 R 201	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9f8566ea-8e2f-46e7-b068-6c6d65ae0746	\N	equipo	GRABADOR	EXTRON	SMP 300	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
42ccf8df-059d-4d33-bff7-e97512a975c2	\N	equipo	GRABADOR	MATROX	MONARCH LCS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
da060b97-ed95-473a-ac29-269ccb7bfa62	\N	equipo	GW.MIDI	ETC	RSN-MIDI-P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
67dd92c8-f35c-42bd-8d8a-b89b3f916e7d	\N	equipo	HANG OUTERS	POLYCOM	POLYCOMSTUDIO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f12f1dd7-51b0-4739-84fe-db33f41c3c4a	\N	equipo	HDMI EMBEBEDOR/DESEMBEBEDOR	BLUESTREAM	HD11AU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6408f9e4-aa80-4fcb-bcb4-d0585258ca19	\N	equipo	INTERFAZ AUDIO	FOCURSITE SCARLETT	18I8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
75239658-40c6-48c0-a3a3-23c7b52642f3	\N	equipo	IPAD	APPLE	MR7G2TY	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b1e01ed7-5b13-4bf2-b28b-bc21257fa1b5	\N	equipo	KIT TECLADO Y RATON	LENOVO	KU-1619	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c582834e-c83c-4ca3-ba5b-2433922d8cea	\N	equipo	KIT TECLADO Y RATON	LOGITECH	K750	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7cb9c7d1-134d-4a9e-95a8-b2ad028f19c9	\N	equipo	KIT TECLADO Y RATON	LOGITECH	K850	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7f40b253-017d-4943-b757-b790053f0122	\N	equipo	KIT TECLADO Y RATON	LOGITECH	MX3200	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3a7296cc-c2f2-40bb-bb81-2801fdd4224d	\N	equipo	KIT TECLADO Y RATON	LOGITECH	MX5500	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
affcac26-8e66-4939-b702-134dacd5d9b9	\N	equipo	KIT TECLADO Y RATON	LOGITECH	Y-RAL57	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bc13ff70-facc-4654-859a-0ebd464bc9af	\N	equipo	MALETA RACK PRENSA	PINANSON	SA SMC 32	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8183664e-94e8-48cf-a5b5-b4d764121dce	\N	equipo	MATRIZ	EXTRON	CROSSPOINT 84 4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
17684453-dbdd-45eb-9960-9b4ce89fe6f1	\N	equipo	MATRIZ	EXTRON	DMP 128 PLUS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e1a9e0b6-8e76-49ba-a720-45a6e55ee9dd	\N	equipo	MATRIZ	EXTRON	DTP CROSSPOINT 1608 4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0634adb7-5e8b-420b-8819-f34e91232dd3	\N	equipo	MATRIZ	EXTRON	DTP CROSSPOINT 82 4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
20a400e4-01d5-4c6e-bb01-863f34b9b54e	\N	equipo	MATRIZ	EXTRON	DTP CROSSPOINT 84 4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9273d853-3385-45dd-842f-c04c276f87e0	\N	equipo	MATRIZ	EXTRON	EXTRON CROSSPOINT 108 4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b588fc8b-edbb-4c4e-972e-9acf5d54f600	\N	equipo	MATRIZ	EXTRON	IN1608	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0cb8416c-9c9d-4e07-9cc0-5e2098a0c483	\N	equipo	MATRIZ	EXTRON	MMX 32 VGA A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c59cda7a-d4dc-4319-811c-0b314c4453a5	\N	equipo	MATRIZ	EXTRON	MVX SERIES	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0c00cb6f-7eb9-43da-8ec0-228fa54ae350	\N	equipo	MATRIZ	LIGHTWARE	MMX8X8-HDMI-4K-A-USB20	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4d1868e6-3d00-4333-92d3-46b276524cb7	\N	equipo	MATRIZ	SHURE	ANIUSB-MATRIX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2db37938-3cba-4462-86c2-94df2ad1355c	\N	equipo	MATRIZ VIDEO	EXTRON	CROSSPOINT SERIES WITCHES	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
eebed8ef-e4cd-403b-aa79-36c2b5b1461c	\N	equipo	MATRIZ VIDEO	EXTRON	DTP CROSSPOINT 84 4K	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e3d8a997-2399-48ed-899f-ef69614b2412	\N	equipo	MATRIZ VIDEO	EXTRON	DTP3 CROSSPOINT 884	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e62777cd-325f-4c0c-a57a-391ea5a746ab	\N	equipo	MESA DE MEZCLAS	YAMAHA	01V96	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
06f088b3-16b9-489d-8abe-98098300cb66	\N	equipo	MESA DE SONIDO	SOUNDCRAFT	EPM6.	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
861e4914-24db-43f9-8ffe-5c703339b135	\N	equipo	MESA DE SONIDO	YAMAHA	01V96	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
55750a81-3ac8-4a52-8cf6-442db3461615	\N	equipo	MESA MEZCLAS	YAMAHA	01V96	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9cd01d19-77ba-4a91-8f01-9f290d00278b	\N	equipo	MESA SONIDO	SOUNDCRAFT	SPIRIT DIGITAL 328	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
21295fd4-ce28-4c1a-ba2e-feba212aeab6	\N	equipo	MEZCLADOR AUDIO	AUSTRALIAN MONITOR	AMIS 120	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1e62f445-2112-4252-bc7a-3164d8b5329c	\N	equipo	MEZCLADOR AUDIO	BIAMP	TESIRA FORTE VI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5292c17f-a374-428b-aa36-802c504e28ce	\N	equipo	MEZCLADOR AUDIO	EXTRON	MVC 121 PLUS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
fa13c350-29e9-4b29-a6cf-ce5c7f5df3b9	\N	equipo	MEZCLADOR AUDIO	QSC	Q-SYS CORE 11OF	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8f691a71-0c9d-4317-9699-1b5754698a86	\N	equipo	MEZCLADOR AUDIO	QSC	Q-SYS CORE 8 FLEX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
662c5e22-ab9d-4733-8776-476a9a897067	\N	equipo	MEZCLADOR DE AUDIO	EXTRON	MVC 121	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6d2ca54f-9c26-4f29-b01a-b88e574201d2	\N	equipo	MEZCLADOR DE AUDIO	EXTRON	MVC-121 PLUS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b43b58c2-9733-43b0-9956-b0b44a8041e2	\N	equipo	MICRO LAVALIER	SHURE	SHURE 185	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ca37f35f-45d2-412d-9c57-fb34557e5ab0	\N	equipo	MICRO PETACA	SHURE	BLX-1 H8E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
84f41497-5ee3-41f1-b720-4389d12fbfcb	\N	equipo	MICRO SETA CAMARA	AVER	VC520 PRO SPKPH	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5cdc1708-c8ff-4019-b8e0-7ad07c9d09a1	\N	equipo	MICROFONIA	SHURE	BLX88	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d6f64330-45cf-48dc-8d1f-f2c3e6fa661a	\N	equipo	MICROFONIA ATRIL	SHURE	MX418 D/C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
aea8fc18-f25b-4037-b95b-68afd17e1e57	\N	equipo	MICROFONOS	SHURE	BLX1288/MX53	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0197b448-2976-42e6-baf8-316549f617e4	\N	equipo	MICROFONO	AKG	HT40	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2f9934a7-7a77-4277-b4db-6cf7a825d7db	\N	equipo	MICROFONO	AUDIO-TECHNICA	ATND1061	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
738bb40c-f8e4-4337-83f6-bbb42da42b42	\N	equipo	MICROFONO	AVER	60U0100000AB	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4617f862-858a-401d-b66f-e97cb3d02022	\N	equipo	MICROFONO	BEYER DYNAMIC	TG 1000	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2ff124d3-4171-44d8-b4e5-b158d12bbb12	\N	equipo	MICROFONO	BIAMP	TESIRA PARLÉ TCM-1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b4a8ea87-a0fe-414e-ade3-93c0f1ca4c4c	\N	equipo	MICROFONO	CISCO	TABLE 20 TTC5-06	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
62d0f023-4f53-4bcf-8eb4-c2650c855a7e	\N	equipo	MICROFONO	CISCO	TTC5-06	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
19049f2f-1635-4eee-849a-0171cb12325a	\N	equipo	MICROFONO	DICENTIS	DCNM-WDE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a7bfedeb-945f-4b96-b656-081eab9ba2b0	\N	equipo	MICROFONO	LOGITECH	989-000171	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1fa637cd-7140-4e80-9fb1-3960a2ddcd4c	\N	equipo	MICROFONO	LOGITECH	LOGITECH GRUOP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
893bbf76-24fe-490a-a4cb-3914e59bdd95	\N	equipo	MICROFONO	OPUS	NE500	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
545cbf2b-648d-46bd-a74c-e051c021f796	\N	equipo	MICROFONO	SENNHEISER	HSP2 CLIP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b1f30ba6-4566-40ce-87ff-e16b72758eb1	\N	equipo	MICROFONO	SENNHEISER	MKE 2-EW GOLD	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7b1ff656-ab88-414b-8fc2-519bc46733ed	\N	equipo	MICROFONO	SENNHEISER	SKM 2000.	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ccdb3470-fd3d-4ad9-8a83-fc524a6101e6	\N	equipo	MICROFONO	SHURE	A412B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ad5d6531-a902-4fec-99bb-f8e55a1cd08d	\N	equipo	MICROFONO	SHURE	BLX1 HBE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f4dd052b-ccde-4928-b23d-695fb4ecda58	\N	equipo	MICROFONO	SHURE	BLX1 S8	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c4500b0c-2011-49b6-9491-1bf0d1582722	\N	equipo	MICROFONO	SHURE	BLX1288	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e9a3f346-6847-4a77-b049-08f2a808fbe3	\N	equipo	MICROFONO	SHURE	BLX1288E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
902d7260-d626-41ec-aa3b-b20a24c3edfd	\N	equipo	MICROFONO	SHURE	BLX1H8E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
03b93e30-462b-44f1-8a86-2d8d4387da30	\N	equipo	MICROFONO	SHURE	BLX2 H8E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0e74939d-2b22-4d22-8817-d2382ae55b0f	\N	equipo	MICROFONO	SHURE	BLX2 HBE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3b47a843-0d37-479e-a968-befb3623f088	\N	equipo	MICROFONO	SHURE	BLX88	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
00988247-c905-44fa-a9f2-6e20f531c581	\N	equipo	MICROFONO	SHURE	MICROFLEX A412B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3dc73c9c-2a27-43ba-8ed1-5ccf2cfe7c6a	\N	equipo	MICROFONO	SHURE	MX418 D/N	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a0a84d85-64e4-4665-bb43-5973d52b9152	\N	equipo	MICROFONO	SHURE	MX418/D	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
65a0d88e-5a9c-451e-90e5-a8499d0537c1	\N	equipo	MICROFONO	SHURE	MX53	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c8896215-e294-48bd-86de-19ed8431e147	\N	equipo	MICROFONO	SHURE	MXA920W	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3d0806c1-aec0-4b36-926c-430487650fae	\N	equipo	MICROFONO	SHURE	MXA920W DANTE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b16299ae-2bb1-4030-aa68-1a5f4f3c423a	\N	equipo	MICROFONO	SHURE	SHURE MXA310W	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ef9e1fb9-c0b0-43ad-ba65-db1c1a1faac9	\N	equipo	MICROFONO	SHURE	SM58	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b750aa2f-78b4-4260-9a9a-a958da9af46e	\N	equipo	MICROFONO	YEALINK	CP50	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c75236c6-1b90-42ee-b1d6-7b010fa9f378	\N	equipo	MICROFONO	YEALINK	CPE40	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d05dec86-c19d-460b-ba7e-cc581e483748	\N	equipo	MICROFONO MANO	SHURE	BLX2 H8E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
fb718eca-c078-4134-8df3-d8a4537bedc4	\N	equipo	MICROFONO MESA	CISCO	CISCO TELEPRESENCE TABLE MICROPHONE 20	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9c420a57-ecce-483e-b83f-3e90d2b0d115	\N	equipo	MICROFONO MESA	CISCO	TABLE MICROPHONE MINI JACK (V2)	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b402309b-a9ac-445c-975d-e6966d56dd16	\N	equipo	MICROFONO MESA	CISCO	TTC5-06	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f185f21a-6485-43dd-aa44-b68e1a10973b	\N	equipo	MICROFONO SOLAPA	SHURE	BLX1 H8E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8526bb58-215e-4682-b3ff-a2b9752ae64f	\N	equipo	MICROFONO/ALTAVOZ	YEALINK	CPE50	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f469aa2b-1dc9-457d-945c-4de305ab9be0	\N	equipo	MINI AMPLIFICADOR	ECLER	CA120	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2cc82010-0e59-4fda-b248-f0a06252a5dc	\N	equipo	MIRRORING	APPLE	APPLE TV	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3f0b7385-910c-43eb-b396-2849cac9eb11	\N	equipo	MIRRORING	MICROSOFT	MS DISPLAY ADAPTER	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d23fd385-aa7e-4277-9ed3-e137160b8a72	\N	equipo	MONITOR	ALBIRAL	17AIVM DVI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
87f82534-7dc8-4f39-a2eb-6a61a8caaae9	\N	equipo	MONITOR	DELL	2407WFTB	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2c540ecf-387c-4557-b0a7-be6edc8eeae1	\N	equipo	MONITOR	DELL	P1917S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
69740547-8ec9-4a9d-8bf6-50dc14b1c111	\N	equipo	MONITOR	FLEX NEWLINE	FLEX - TT-2721	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7ba2940b-5144-47a7-884a-428c23f99054	\N	equipo	MONITOR	HP	E24 G4 FHD	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d90bfe48-615c-4f77-a402-46cdf31b9867	\N	equipo	MONITOR	LG	75XS4P-B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a078eb9e-f075-4c49-bacf-6b0b50d8aeab	\N	equipo	MONITOR	LG	FLATRON M3200C-SAF	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4c26afe3-2df2-4b91-9e76-09bb313afa99	\N	equipo	MONITOR	NEWLINE	TT-2721AI0	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1bd618ce-fb1d-421d-b2e8-1e3ca59b1231	\N	equipo	MONITOR	PHILIPS	B-LINE 70BFL2214/12	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f3cffdd4-75c9-4169-8a84-b79db3a79a87	\N	equipo	MONITOR	PHILIPS	BRILLIANCE 19B1CB/00	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3b6d482e-0fa5-43fb-9095-48eda35a9643	\N	equipo	MONITOR	SAMSUNG	713BM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
48b98bd9-aae5-4136-9457-eaab18734b8a	\N	equipo	MONITOR	SAMSUNG	QB55R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
015ba2ca-c1fa-46a2-b5e8-ab2daa962af8	\N	equipo	MONITOR	SAMSUNG	QB65R-B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0861661f-0983-4727-925d-32d877436122	\N	equipo	MONITOR	SAMSUNG	QB75N	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
05c1642a-d164-49a0-a7e2-edba888177d3	\N	equipo	MONITOR	SAMSUNG	SYNCMASTER 320 PX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4ffefa6d-e731-4600-b144-cf302882dbd3	\N	equipo	MONITOR	SAMSUNG	UE60J6200AK	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d2bd4f01-028d-428a-a9c3-ae14d6000c64	\N	equipo	MONITOR	SMARTPODIUM	ID422W	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bc94ed34-a9c9-4e3f-811c-a5bb39409075	\N	equipo	MONITOR	SONY	FWD 32LX1R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3e59bb73-526b-47f6-9d29-4a9d3f59ee80	\N	equipo	MONITOR	SONY	FWD- 46EX650P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0b5c3fc6-973a-4259-8939-43c476a5a161	\N	equipo	MONITOR	SONY	SONY TV *01	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
179ac7d4-4487-4955-a06c-696b90b4399a	\N	equipo	MONITOR TRABAJO/REF.	DELL	E228WFPC	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c52ed47c-46b8-4559-a087-376ec52523a3	\N	equipo	MONITOR TRABAJO/REF.	NEWLINE	S34A650UBU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7783ded5-82b8-4a09-b167-74cbe0b76b78	\N	equipo	MONITOR TRABAJO/REF.	SAMSUNG	LS34A650UBUXE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4ed19108-4946-404e-bcfe-fc5aefc0458d	\N	equipo	MONITOR TACTIL	AVOCOR	AV6530	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
90b342e8-2111-49a6-bf1b-4326d12265b6	\N	equipo	MONITOR TACTIL	SAMSUNG	QB55R-B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
efd8fa22-e040-4e03-b711-bed3f9eb1fe1	\N	equipo	MONITOR TACTIL	SMART	PODIUM 524	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bd290d17-728f-4c5c-a3bd-774bde1d69bb	\N	equipo	MONITOR TACTIL	SMART	PODIUM ID422W	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
cf909b40-702a-4c67-a26d-3797217ca35b	\N	equipo	MUEBLE	VOGELS	PVF 4112	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1189b50c-d7ec-4f79-b170-62f42fe9b591	\N	equipo	MULTIVENTANA	BLUSTREAM	AMF41W	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8d8da373-cf55-456c-b2c0-e0cf13b979d5	\N	equipo	MULTIVENTANA	CRESTRON	HD-WP-4K-401-C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7fc2f70d-89cc-407c-9b77-d647773cc3dd	\N	equipo	PANEL TACTIL	AMX	MST 701	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2f3013ad-4c47-4944-8d2e-9853c38ba048	\N	equipo	PANEL TACTIL	AMX	MST-431I	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b95b2a35-e44f-4d85-b2dd-cdda14f3fb2a	\N	equipo	PANEL TACTIL	AMX	MST-701I	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
946e31e0-0909-4d0b-a7d1-daa0808497ae	\N	equipo	PANEL TACTIL	AMX	MXT-701	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d58fc0a4-93a6-4f6b-b8ef-f53e3e96730b	\N	equipo	PANEL TACTIL	CISCO	ROOM NAVIGATO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b09541e4-a2e2-46bf-ba81-20b00c6c1f44	\N	equipo	PANEL TACTIL	CISCO	TOUCH 10 TTC5-09	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a46da14a-ff59-40bf-8467-52b0e9756a6a	\N	equipo	PANEL TACTIL	CISCO	WEBEX ROOM NAVIGATOR	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8378b709-a942-475f-bb4e-86e436d02f38	\N	equipo	PANEL TACTIL	CRESTON	LC 3000B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6428620e-73c2-4a73-9e66-3f91ce238bf7	\N	equipo	PANEL TACTIL	CRESTRON	TS-1070-B-S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
25921321-d1f4-4d35-926e-e0eaed091b7c	\N	equipo	PANEL TACTIL	CRESTRON	TS-770 (M201923005)	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a1faa0fb-348d-46b3-8568-d2692e9abaeb	\N	equipo	PANEL TACTIL	CRESTRON	TSS-70	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f24d1391-4764-492b-9409-6bb273b539f5	\N	equipo	PANEL TACTIL	CRESTRON	TSW-1060-B-S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
16c6adaf-c598-4742-874c-984129b6954e	\N	equipo	PANEL TACTIL	CRESTRON	TSW-760-B-S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
af350e84-e6f8-4f6e-bca3-103312fcd4b0	\N	equipo	PANTALLA	AVOCOR	AV6530	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a3c56e59-23d0-43e2-a73c-236577578439	\N	equipo	PANTALLA	AVOCOR	AVE8630	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9dc3f780-7fd8-4b25-8a96-091d52b022f7	\N	equipo	PANTALLA	HUAWEI	IFP-UG65	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1f7b7006-1036-4ca2-8ef8-0ca1099b9668	\N	equipo	PANTALLA	NEW LINE LYRA	TT-5521Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b5d0b2a1-1689-47c0-bc1b-3964e3cd80b2	\N	equipo	PANTALLA	PANASONIC	TH-42PF30ER	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3688de17-7439-47d1-9fe5-b690bab3959c	\N	equipo	PANTALLA	PANASONIC	TH-50PF20ER	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1bf1c234-b833-4d8e-bf9b-9abb6bfb351c	\N	equipo	PANTALLA	PHILIPS	50PUS6162/12	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
00bd6573-5e73-4ebd-947b-ab58268bf1c3	\N	equipo	PANTALLA	PLUS SCREEN	135” PE300-2WF	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c6b61365-d70d-46cb-978a-db1eee663dbf	\N	equipo	PANTALLA	SAMGUNG	QB65N	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e3b49fa8-9df7-4d62-b7ba-246d6a64cd05	\N	equipo	PANTALLA	SAMSUNG	320P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5b31e1e5-8a4d-4880-aae4-18600a8033b7	\N	equipo	PANTALLA	SAMSUNG	75.0	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
58f8429b-c85e-47cc-8802-da93411368e6	\N	equipo	PANTALLA	SAMSUNG	LH65QBHPLGC/EN- QB65H	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6242025c-c183-47b0-a08b-065434598066	\N	equipo	PANTALLA	SAMSUNG	ME95C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4c026d44-45ce-4f9c-9eb7-526548deaadb	\N	equipo	PANTALLA	SAMSUNG	P0-A5-MON-65	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
fd6d0ea7-82c1-41bc-a2cf-0c465fabd75b	\N	equipo	PANTALLA	SAMSUNG	PS51D450A2WXXC	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a51c3252-f009-483d-8d12-50c2ea8908dc	\N	equipo	PANTALLA	SAMSUNG	Q875B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b2e17454-af90-4c81-9b81-0f93e1e06854	\N	equipo	PANTALLA	SAMSUNG	QB75B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c149afd2-015e-42fb-8510-472b8cfb722f	\N	equipo	PANTALLA	SAMSUNG	QB75H	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
774888a6-a3c3-4b8f-a12b-15578d8ffa42	\N	equipo	PANTALLA	SAMSUNG	QB85C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8f90dfe2-5d12-4379-955a-a84438c383b0	\N	equipo	PANTALLA	SAMSUNG	QB875R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5f4e31e6-dee6-4b51-85b7-340d1755a998	\N	equipo	PANTALLA	SAMSUNG	QBC-65	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
14cb99d7-9bf1-42d7-bb5e-8aacc7fdc0be	\N	equipo	PANTALLA	SAMSUNG	QM75C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8993608c-2be4-4de8-a0d6-ae02f6bf3a09	\N	equipo	PANTALLA	SAMSUNG	QM75R-B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
54925235-9c92-461c-b3a7-6f377f27698e	\N	equipo	PANTALLA	SAMSUNG	QM98T-B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
31870cc4-1380-4a50-907d-cb0b8cc84251	\N	equipo	PANTALLA	SAMSUNG	SYNCMASTER 710N	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5d062f26-e5b2-4fdb-b429-61298eebfdf6	\N	equipo	PANTALLA	SAMSUNG	UE40B6000	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1df186de-b77f-4f44-92a3-91d08cb4b39c	\N	equipo	PANTALLA	SAMSUNG	UE60J6200AK	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
38f13842-096a-4d9d-94e7-07290b9ede19	\N	equipo	PANTALLA	SANSUNG	QB55R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4aa446ab-8e3c-4800-be3c-0d7a18a0d72b	\N	equipo	PANTALLA	SANSUNG	QB65R-B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
338cb44b-4243-4c66-8498-707fd2be6e5b	\N	equipo	PANTALLA	SONY	BRAVIA65W855A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9ae681ab-d940-4284-b52d-5f6612fd1128	\N	equipo	PANTALLA	SONY	BRAVIAKDL46EX653	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
cd47f143-1f12-40c9-895b-47462e8e9c54	\N	equipo	PANTALLA	SONY	FW - X8570C	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
17eb7e20-2bbe-4dc5-942d-b4b2df84e331	\N	equipo	PANTALLA	SONY	FW-55XE8001	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
18cdf06f-8bd2-4fc0-9094-15101fee2cb2	\N	equipo	PANTALLA	SONY	KD 65X8505B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9f086f42-5795-426e-9eb1-6fb187b7bce2	\N	equipo	PANTALLA	SONY	KD-65X8505B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d446ab2a-c7c2-46a4-bcb7-f2c0b7b4cc11	\N	equipo	PANTALLA	SONY	KDL 65W855A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7a6f0e9f-bd24-4ea3-99ee-aeb89bea1418	\N	equipo	PANTALLA DE PROYECCION	ELECOM 2	ELECOM-2 PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
fbf4b221-c2a2-4fc0-aef3-eac27cf607ce	\N	equipo	PANTALLA DE PROYECCION	ELITESCREEN	PE300-2WCB	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3304f33e-b379-4d39-be14-5e62423a4dbb	\N	equipo	PANTALLA DE PROYECCION	ELITESCREEN	PE300-2WCB PREMIUM FRONTAL	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b75a2ef0-151f-412c-b843-4127afabc87e	\N	equipo	PANTALLA DE PROYECCION	ELITESCREEN	SK110NXW-E10	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
68de5cc5-19e9-4212-8c15-9d92a8dbacb5	\N	equipo	PANTALLA DE PROYECCION	ELITESCREEN	STARLING 120	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f7b313bc-f763-48c8-bdf1-853905f6770c	\N	equipo	PANTALLA DE PROYECCION	INDETERMINADA	PANTALLAPROYECCIÓN	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
01dbb4c6-79c6-4f5f-b274-3bcb23ea48e9	\N	equipo	PANTALLA DE PROYECCION	INDETERMINADA	PROYECCION INDETERMINADA	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4372c164-8dd0-4c08-8d53-ef606b8c9b8b	\N	equipo	PANTALLA DE PROYECCION	SPACE	ADTP_TO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
019c4063-afcf-4ff4-b387-673a2d4b3d1b	\N	equipo	PANTALLA DE PROYECCION	SPACE	NP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5ec1fd8c-fbc6-4843-871b-4b75aa4c8456	\N	equipo	PANTALLA ELECTRICA	ELITE SCREENS	ELECTRIC100XH	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5dd1282c-1afa-4a25-9666-e7299abdc987	\N	equipo	PANTALLA ELECTRICA	SCREEN LINE	SCREEN LINE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9d047a15-d17b-4d01-b1c8-29eceb8088bc	\N	equipo	PANTALLA MECANIZADA	COMMTEC SCREEN	ELECTRIC MASTER II	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4ef10014-8be3-4324-b8bf-4b3e22ea1bc3	\N	equipo	PANTALLA RETROPROYECCION	INDETERMINADO	PROYECCION INDETERMINADO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
fb53d531-350a-483d-8e39-b066f87b0e6c	\N	equipo	PANTALLA TACTIL	EXTRON	TLP PRO 1220 MG	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a0cb0cad-fdb3-4c8d-979e-39007382b4df	\N	equipo	PASADOR	BLUESTREAM	AMF41W	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
982743e3-5b31-44c6-a7a9-97eafe992a6d	\N	equipo	PASADOR	LOGITECH	1911LZ0A1MQ9	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8fc36b7d-4ecd-417f-868f-cf2cc172396c	\N	equipo	PASADOR	LOGITECH	LOGITECH R400	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2154c719-607d-47a3-8fac-34fcf7bdfb5f	\N	equipo	PASADOR	LOGITECH	R400	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ea09c379-e557-4b70-a113-9d67985efc3c	\N	equipo	PASARELA	PLANET	ICS-110	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b2167d39-3a25-47d5-9314-562af336056d	\N	equipo	PASARELA RELE	GUDE	EXPERT POWER CONTROL 2304-1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c98dab1c-ed74-462a-a3dd-a8682e02f2ed	\N	equipo	PASARELA RS232	CRESTRON	CEN-IO-COM-102	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c9a3007c-3458-4d28-a07d-640278e5ec4e	\N	equipo	PC	FUJITSUSIEMENS	ESPRIMO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
36d2f404-4f62-4684-b976-2e55c6de2fcf	\N	equipo	PC	HP	600 G4 DESKTOP MINI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
604249a2-808c-4902-8205-e3f42af48697	\N	equipo	PC	HP	600 G4 MINI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2715fc65-7cf8-4518-aab9-d08c950ed37f	\N	equipo	PC	HP	COMPAQ PRODESK 600 G4 DM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7bffb533-4bdd-483a-b1ce-1ba785fabf82	\N	equipo	PC	HP	ELITE DESK 800 G5	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
60ce97b9-d48e-41ef-8757-2bb1a679df25	\N	equipo	PC	HP	ELITE DESK 800 G5 DESKTOP MINI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
29967384-8f15-4569-b8d8-2158816eda37	\N	equipo	PC	HP	ELITEDESK 800 G3 MINI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5bc50f6f-5944-4f49-8fc2-b4ace959cc03	\N	equipo	PC	HP	ELITEDESK 800 G4 SFF	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b0d0c770-9c97-4f45-b4e4-1705de30d823	\N	equipo	PC	HP	ELITEDESK SFF 800 G5	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7c1ac9c9-b652-426d-9360-628e71f46783	\N	equipo	PC	HP	ELITEDESK SFF 800 G9	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
51bbc350-18b7-4d07-9f43-d0a8d6481cd5	\N	equipo	PC	HP	HP COMPAQ PRODESK 600 G4 DM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3b1bd3a3-734d-481a-a296-27794b133172	\N	equipo	PC	HP	HP ELITE DESK 800 G5	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7b9f8e28-a760-4043-a7f0-228838f92de6	\N	equipo	PC	HP	HP PROBOOK 640 G2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ca0bb39a-b06e-46f8-ba59-6ce37ab5ea61	\N	equipo	PC	HP	PRODESK 600 G4 DM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5c93eb81-8eda-4589-bc08-0a21afbc113f	\N	equipo	PC	HP	PRODESK 600D4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bbf31eb3-798e-47d3-8dd6-a2b3a828ce82	\N	equipo	PC	LENOVO	10V8S01F00	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
114e50f8-792e-487c-9fb1-230f960962cd	\N	equipo	PC	LENOVO	910Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b97a55ae-f7c7-454f-a4d6-fdae2b314b4f	\N	equipo	PC	LENOVO	M10B4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f66b3c44-7f0f-420f-aaa8-2e61eb1ef938	\N	equipo	PC	LENOVO	M10Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d17d6a86-a068-4b15-ae88-4b972d8d0d55	\N	equipo	PC	LENOVO	M70Q GEN5	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ec704a52-66b0-45df-8f62-d7110dc21024	\N	equipo	PC	LENOVO	M72 I3	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6aa6d0f4-dc32-4d66-88a7-1d115a96e810	\N	equipo	PC	LENOVO	M92P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0e3e61d2-1b90-4ffa-a64c-1d90e7713585	\N	equipo	PC	LENOVO	M93 I3	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4682468d-813c-45f8-9d49-302ec1a131d5	\N	equipo	PC	LENOVO	M93 P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bf12db0e-c741-4dd3-8dfb-b4017437ad32	\N	equipo	PC	LENOVO	THINKCARE M72E I3	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
862083db-a4e9-48b0-937b-538e3663e0b2	\N	equipo	PC	LENOVO	THINKCARE M73	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5c4842cf-71e6-4015-b42f-3581ecf8f9d6	\N	equipo	PC	LENOVO	THINKCARE M93P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7fc35752-d8ee-4736-a2e4-787058506c66	\N	equipo	PC	LENOVO	THINKCENTRE M920	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
fef1e0bd-aa7d-42cf-98e1-d3eb0cb96b43	\N	equipo	PC	LENOVO	THINKCENTRE M920 TINY	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
dec66e36-5a9b-4888-b5a7-8c68a741ffea	\N	equipo	PC	LENOVO	TINY	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3c09aa5a-70c0-48c6-bab2-03819d9444cd	\N	equipo	PC	LENOVO TINY	THINKCENTRE M920Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f1d2b9fe-5f18-492b-a22e-5aae834b33d7	\N	equipo	PC	PT	PT	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5e766c40-5aaf-4023-b6a3-e5d553bb4264	\N	equipo	PC SALA	HP	HP PRODESK	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
44013ace-514a-4477-8a69-c336e9803ccf	\N	equipo	PC SALA	LENOVO	M920Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
964f6a56-5f4d-4872-a328-b4c8a2d031f9	\N	equipo	PIZARRA INTERACTIVA	LOGITECH	LOGITECH SCRIBE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a8126915-2db1-424a-9e11-40d469ed20b5	\N	equipo	PORTATIL	HP	PROBOOK 640	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b04cae47-d919-4ba8-8dd9-91906022f778	\N	equipo	PRESENTADOR	BARCO	CLICK SHARE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b53b3e7a-0733-469f-873b-fd4215e43a29	\N	equipo	PRESENTATION PDD	YEALINK	WPP3D	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
12d4e99c-af77-4746-a63a-0db0cb55fff2	\N	equipo	PREVIO AUDIO USB	BOSE	TONEMATCH T1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d5a22003-9fd2-40a6-913f-1de13706f6ba	\N	equipo	PREVIO BEHRINGER	BEHRINGER	ULTRAGAIN PRO 8 DIGITAL (ADA8000)	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
08141508-90ef-4514-85e2-1fa948390c4e	\N	equipo	PROCESADOR AUDIO	BIAMP	TARJETA DANTE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7cb3f66a-de90-4fff-a641-85869c677596	\N	equipo	PROCESADOR AUDIO	BIAMP	TESIRA CONNECT TC-5	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
533221f8-f096-4921-891c-896eda79d819	\N	equipo	PROCESADOR AUDIO	BIAMP	TESIRA CONNECT TC5	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a21f8cb1-dfb7-4004-ba59-34ce135bb89a	\N	equipo	PROCESADOR AUDIO	BIAMP	TESIRA FORTE DAN-CI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
35542e96-fecc-4eed-93df-ff30fc925a49	\N	equipo	PROCESADOR AUDIO	BIAMP	TESIRA FORTE VI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
41457743-b7f7-4fa9-9888-a557c6c9086c	\N	equipo	PROCESADOR AUDIO	BIAMP	TESIRAFORTÉ AVB CI.	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3615a231-ef96-4224-ae41-7ec8569d07ab	\N	equipo	PROCESADOR AUDIO	BIAMP	TESIRAFORTÉ CI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
714bd0f8-260b-4acf-917d-ce2f3563385d	\N	equipo	PROCESADOR AUDIO	Q-SYS	CORE 8 FLEX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bee9080c-41b3-4aab-832a-84a58181f993	\N	equipo	PROCESADOR AUDIO	QSC	CORE 24 F	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6b7f08f0-97a1-4aab-aeaf-36205e4586ce	\N	equipo	PROCESADOR AUDIO	TESIRA	TESIRA FORTE VI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e949cd5c-d696-4756-8b70-d9cf40d70242	\N	equipo	PROCESADOR CONTROL IP	EXTRON	IPCP PRO 250	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a558670d-bafe-4ca0-a767-4b3dcaafdb7d	\N	equipo	PROCESADOR DE AUDIO	BIAMP	TESIRA	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
fc827638-d81d-4188-8432-1fbec5540987	\N	equipo	PROCESADOR DE AUDIO	BIAMP	TESIRA FORTE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
051f01db-06d2-4b0c-b246-5a020179b28c	\N	equipo	PROCESADOR DE AUDIO	BIAMP	TESIRAFORTE AI	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9e4a04da-f1fc-43e2-9aea-943af74aee2a	\N	equipo	PROCESADOR DE AUDIO	BIAMP	TESIRAFORTE AVB VT4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
78b13197-ee26-4ccc-bca5-b81e3bad428c	\N	equipo	PROYECTOR	EMP-1825	KG5F8Y0246L	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c47c76a7-2d48-429f-8e07-8ee7f830ec6b	\N	equipo	PROYECTOR	EPSON	1825 3LCD	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
df2a9fca-b600-41d3-8311-789dab000f2f	\N	equipo	PROYECTOR	EPSON	1915.0	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bf6f907e-a23d-4fc7-8660-cdeecfb505d6	\N	equipo	PROYECTOR	EPSON	1985WU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b51c28cb-fc7d-4194-bb13-258d77bc368e	\N	equipo	PROYECTOR	EPSON	EB 1955	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
394d6ff6-45d3-4bd4-ac1a-1a11578add52	\N	equipo	PROYECTOR	EPSON	EB- 1985WU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
52679512-09bb-4b84-a152-87b616208760	\N	equipo	PROYECTOR	EPSON	EB- 810E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f1deb2c4-6200-4983-a8f4-a88582965c7a	\N	equipo	PROYECTOR	EPSON	EB-1485F	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
01ea364d-f9dc-4540-a54b-dc6e31b98de7	\N	equipo	PROYECTOR	EPSON	EB-1825	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
96b8a965-a46a-4b74-a2cb-3aa3320e5cf2	\N	equipo	PROYECTOR	EPSON	EB-1985WU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
aaf340cf-a679-4a3c-a396-a0798559838a	\N	equipo	PROYECTOR	EPSON	EB-2040	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
cb0a9f1a-f189-465c-a426-96b16fd2459a	\N	equipo	PROYECTOR	EPSON	EB-700U	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
738c8b33-83f6-4651-beb7-eb1a632b3132	\N	equipo	PROYECTOR	EPSON	EB-805F	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
176481c5-b4bb-473b-8ce4-49fa7aa0797f	\N	equipo	PROYECTOR	EPSON	EB-L610U	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bc752534-28d8-43d7-aab5-453a2d1c8127	\N	equipo	PROYECTOR	EPSON	EB1830	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b30d1fd5-5bb3-4126-ab45-6f57616c6bdd	\N	equipo	PROYECTOR	EPSON	EB1915	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4bf37584-8210-41dc-9daf-926537763bd0	\N	equipo	PROYECTOR	EPSON	EB1985WU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2f078d8d-d746-4e43-a2b1-1e88b74c06f7	\N	equipo	PROYECTOR	EPSON	EMP 1815	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2dd39562-711f-4876-8a37-7611ca4844a6	\N	equipo	PROYECTOR	EPSON	EMP-1825	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2412cc94-1d24-4cb9-91f6-01baaf1705dc	\N	equipo	PROYECTOR	EPSON	EMP-830	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
756b6acc-5352-41a4-abf4-4f14daac51f7	\N	equipo	PROYECTOR	EPSON	EMP830	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ff5e383f-b726-4124-86b1-1c8495429c43	\N	equipo	PROYECTOR	EPSON	NP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8cd8049d-4ba8-41ed-98de-5ce1cd9c54e9	\N	equipo	PROYECTOR	HITACHI	CP-RX94	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5fa40e2b-0053-4872-aed2-344d5a0d8bc0	\N	equipo	PROYECTOR	MITSUBISHI	X400BU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9fde0090-bf0b-439b-a16f-46219efff011	\N	equipo	PROYECTOR	MITSUBISHI	XL9U	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c82c0f67-92db-4d70-ad69-fa0aa5aab4aa	\N	equipo	PROYECTOR	NEC	P605UL	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c5aa1bc8-9937-44e9-b033-9845e65aa4e5	\N	equipo	PROYECTOR	NEC	P627UL	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e06b6ff2-3f94-43ff-aed3-a7d7e3793f07	\N	equipo	PROYECTOR	PANASONIC	PT-VMZ61	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a5d69599-00c0-4609-9920-c746cecd5bf3	\N	equipo	PROYECTOR	SONY	VPL PHZ10	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
84fcaf63-4ad1-4bb8-bcdf-38fc1931f5f8	\N	equipo	PROYECTOR	SONY	VPL-FHZ131L	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b2093e1b-eb8e-483b-a707-bd1df2aae394	\N	equipo	PROYECTOR	SONY	VPL-FHZ700L	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
71f4a233-3578-40ee-960a-655b7d81024e	\N	equipo	PROYECTOR	TOSHIBA	T350	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2a62cd97-f1e6-4ea1-a726-ba3b5d26988c	\N	equipo	PROYECTOR	TOSHIBA	TDP-T355	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d68ee36e-eb3f-45bb-b420-a9692dc9595a	\N	equipo	PROYECTOR	VPL	VPL-PHZ10	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8034c318-c7c5-40b1-ae1c-e3e22561bdd8	\N	equipo	PUPITRE	BOSCH	DCN-IDESK-D	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5ad0190e-802e-4b0e-a2b7-01dbd596cdec	\N	equipo	RADIADOR IR	BOSCH	LBB4511/00	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5ceab9fb-cb5c-4e33-a125-5013efcc4f90	\N	equipo	RATON	LOGITECH	LOGITECH MX 3200 LASER	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f3f8c717-6349-43fb-a5bf-fd633e1880f6	\N	equipo	RATON INALAMBRICO	LOGITECH	MX5500 REVOLUTION	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c37618df-ffdd-4e05-abcb-7ab1b0c8c4d0	\N	equipo	RECEPTOR	EXTRON	DTP 60-1271-13	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
af8da373-5ec0-4304-b212-5a2c69a53a04	\N	equipo	RECEPTOR	EXTRON	DTP HDMI 230 RX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
00dcbdaf-e22b-4579-9467-86265ada5e7c	\N	equipo	RECEPTOR	SENHEISER	SENHEISER EM2050	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
530a4bd5-f132-45ca-a50a-b987380b1a02	\N	equipo	RECEPTOR	SHURE	SLX D4D	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
34c3c309-cf4c-4dcc-b00a-dbe4c884d568	\N	equipo	RECEPTOR AUDIO	SHURE	BLX88 RECEPTOR	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
718d4986-fca4-4314-b40a-09acc306387f	\N	equipo	RECEPTOR HDBASET	CRESTRON	HD-RX-101-C-E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
cf79c64d-97b4-4b20-9715-165619d50db4	\N	equipo	RECEPTOR HDBASET	SCT	RC5-HE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
71c58178-7a3b-483b-ba62-15b512ed0efe	\N	equipo	RECEPTOR INALAMBRICO	BEYER DYNAMIC	TG1000	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7b2b13e2-e225-4f93-aeb6-f204562a79ee	\N	equipo	RECEPTOR MICROFONO	SHURE	BLX1288E/W85-H8E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ce136180-9b38-466e-a131-83f24577350a	\N	equipo	RECEPTOR MICROFONIA	AKG	SR40 FLEXX PRO DIVERSITY	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9865ff00-83fe-40b4-b3eb-b41d8d51e53b	\N	equipo	RECEPTOR MICROFONIA	SHURE	BLX88 HBE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bbddcdd0-ae0c-48ff-9e06-fbf8cfca5cf0	\N	equipo	RECEPTOR MICROFONO	SENNHEISER	EW300 G3	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ed97d5e8-b7c0-4f62-b89b-3b22dcbb8f02	\N	equipo	RECEPTOR MICROFONO	SHURE	BG58	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f4cebbb7-04eb-4ec7-ba36-dac40d15b60e	\N	equipo	RECEPTOR MICROFONO	SHURE	BLX1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3cc54083-17ae-4696-989c-930855a725b2	\N	equipo	RECEPTOR MICROFONO	SHURE	SLX4 L4 (638-662 MHZ)	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6d047e6c-7a32-4559-a110-65330db5b0d0	\N	equipo	RECEPTOR USB	BLACK BOX	IC408A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
556c8b83-52fa-4b27-b67b-6017ae043644	\N	equipo	RECEPTOR VIDEO	CRESTRON	DM-NVX-D363	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e2d23ce9-dc01-4d9b-aa18-4f794599fdd2	\N	equipo	RECEPTOR VIDEO	CRESTRON	DM-TRRX-100-STR	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2875c26a-ec60-4844-b90b-4c39183c01ce	\N	equipo	RECEPTOR VIDEO	CRESTRON	HD-RXC-4KZ-101	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f4124aa5-7add-44e8-8272-2849d3cf9213	\N	equipo	ROUTINGSWITCHER	KNOX	RS16*16HB	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bbb7539e-bedc-4dd3-833e-597f91be39eb	\N	equipo	SELECTOR	EXTRON	DTP T DSW 4K 233	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a8c8e67e-4ec5-43f2-925f-024cdb7fd718	\N	equipo	SELECTOR	EXTRON	IN1604 HD	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3a15e864-e512-4e9d-81c1-362ac1e5cb8a	\N	equipo	SELECTOR	EXTRON	IN1606	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2cc2eaeb-3725-4258-a093-1c92193ab4e2	\N	equipo	SELECTOR	EXTRON	IN1608	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e4822c95-ae5d-4c13-9b07-af902fb6e035	\N	equipo	SELECTOR CONMUTADOR VGA	EXTRON	SW2 VGA DA2A	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
12dd81aa-fe9c-465c-b1b3-b4a8993b3cf8	\N	equipo	SENALETICA	STEELCASE	ROOMWIZARD II	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
cd4f4842-e976-44f1-a6c4-49fa664011ed	\N	equipo	SIN CATEGORIA	LENOVO	THINKCENTRE M920Q	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
17ad93d8-3cff-4e76-80b2-dce6fc47db92	\N	equipo	SIN CATEGORIA	LOGITECH	PERFORMANCE MX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
fb79caea-cb55-4a9a-acc2-94a4514bb280	\N	equipo	SISTEMA DE DEBATE	BEYER DINAMIC	ORBIS CU	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
792bad44-bf24-422a-ac6a-d4b489d075fb	\N	equipo	SISTEMA MICROFONIA	SHURE	BLX1288	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
10e155ce-6f28-4f82-82ce-d277ca73a9e6	\N	equipo	SOPORTE	VOGELS	MRF-1RP4	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
32db0c77-5a7e-4bff-b218-69fa4e44fb9b	\N	equipo	SOPORTE	VOGELS	PPC1585	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a3baf1c9-5ae4-45a5-a274-c8e8545491db	\N	equipo	SOPORTE	VOGELS	PVA 5070	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f90b58cd-1400-488e-b88e-9861aa34774b	\N	equipo	SOPORTE CAMARA	VOGELS	SOUND 3550	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
35c09fa5-a0c0-433e-a810-c75cf036d114	\N	equipo	SOPORTE DE PIE	VOGELS	FD 2064S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
235b30c1-6c4a-4116-85a5-2f1af7ecc4d6	\N	equipo	SOPORTE PANTALLA	DIMASA	FLEXR	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
38af551b-76ec-492d-a219-15f1afb536ed	\N	equipo	SOPORTE PANTALLA	EDUSTAND	EDUMOVE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8c114138-514a-4e81-972f-f1326ba60fdf	\N	equipo	SOPORTE PARED	EXTRON	UTS 100	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f784df21-4b6d-408e-86e1-556061f21a20	\N	equipo	SOPORTE PIE	VOGELS	T1844B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0707d577-b2f6-486d-bb32-7347bcf932b2	\N	equipo	SOPORTE PROYECTOR	VOGELS	PPC 1555	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4431edde-9094-4c20-9d75-b3df26cb6a59	\N	equipo	SOPORTE PROYECTOR	VOGELS	PPC1585	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c6ce4f98-eb36-4803-aa5a-d67d2f211dc5	\N	equipo	SOUND STATION	AVER	VC520+	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4a1aa056-e26e-48f7-a008-7552aa9704be	\N	equipo	SOUNSTATION	LOGITECH	886-000056	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
23d3d1c3-505d-45d6-82fa-a9fe26be28e5	\N	equipo	SP DANTE	Q-SYS	CORE 8 FLEX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
156cb95e-74e8-46c9-96b3-b9cdbff9e336	\N	equipo	SPLITER	PINANSON	P740603	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
33b39dd4-d3d9-421e-a131-827f941b9c58	\N	equipo	SPLITTER PRENSA	PINANSON	SPP X12	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e41e1fbf-0830-4f93-bc33-8dcf6f03c89d	\N	equipo	STEREO DOUBLE CASSETTE DECK	PIONEER	CT-W208R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
af264d89-7caf-490b-8703-e3c65782fb9a	\N	equipo	SUPRESOR FEEDBACK	DBX	AFS 224	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e912f338-a2fd-456a-8bc8-e356da8e6ea2	\N	equipo	SWITCH	NETGEAR	GS308PP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2a2f2ea2-9db2-4c14-944a-0a941fab2d9a	\N	equipo	SWITCH	NETGEAR	GSM 4212UX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f3159ef4-ab5f-4c18-b5d0-8d6fc67137ec	\N	equipo	SWITCH 4X1 (RACK)	CRESTRON	HD-MD4X1-4K-E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f92107df-dd0c-4070-a244-546bbced01f4	\N	equipo	SWITCH/SELECTOR	EXTRON	MVX SERIES	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
62022856-48d0-4499-a67d-3116c6e39b83	\N	equipo	SWITCHER	D LINK	DGS – 1008 MP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8eb919fe-3ec2-4a87-a4c3-0bd11655be1c	\N	equipo	SWITCHER	NETGEAR	GS305EPP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1968890d-2f34-4ece-9567-c192730405bd	\N	equipo	TARJETA DANTE	EXTRON	EXTRON AXI 44 AT	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4ddcf4d1-1d5d-40a1-ad1e-56aaa18c274a	\N	equipo	TARJETA SONIDO EXTERNA	M-AUDIO	BLX1288/MX53	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
80a1d54a-fe30-477a-a269-7ba5751beb98	\N	equipo	TECLADO	LOGITECH	K400 PLUS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e251ece6-3431-4b2b-bffe-8581922df182	\N	equipo	TECLADO	LOGITECH	MK700	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a24edf6d-9150-4e96-a3cc-33e2df6cbc0c	\N	equipo	TECLADO	LOGITECH	MX5500 REVOLUTION	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
8e06da32-4eb4-454e-a9c0-b0091e8c4a66	\N	equipo	TECLADO	LOGITECH	NP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
749fbe38-05f5-40c6-a096-86a6752be731	\N	equipo	TECLADO/RATON	LOGITECH	K400	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0774a215-f9ec-4211-84ee-10c644f2eee2	\N	equipo	TECLADO/RATON	LOGITECH	K400 PLUS TV	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3bcbb73c-d99b-4f3a-8774-b2f24178b03e	\N	equipo	TECLADO/RATON	LOGITECH	K850	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
829b021b-dae6-4aa3-bd20-6e740d3ecb3e	\N	equipo	TECLADO/RATON	LOGITECH	MX 3200 LÁSER	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5ab58a86-8a3d-42d3-832f-aa5fda546000	\N	equipo	TECLADO/RATON	LOGITECH	MX3200	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4a55e972-ad1f-404b-9110-9c5234e8f8fc	\N	equipo	TELEFONO	CISCO IP	NP	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
86ce50ce-3041-4ec7-abca-f96b68b260fa	\N	equipo	TELEFONO IP	CISCO	CP-7961	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2cf35476-22c5-4b20-aea0-7a2166101ba0	\N	equipo	TELEFONO IP	CISCO	CP-7975G	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
faeb3b9f-b32b-4547-b770-e9436f600155	\N	equipo	TOTEM	DIMASA	CONRUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
864b1619-6d13-48e9-9ef5-f2fbfa7407d3	\N	equipo	TOTEM	DIMASA	FLEX-R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b5ae24b9-8787-4749-9b17-446ec631648e	\N	equipo	TOTEM	FONESTAR	STS-40106P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a944df5b-484f-4e33-a23b-33f634cafd2d	\N	equipo	TOTEM	INDETERMINADO	SINRUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
bfb034d7-b6ad-4a32-88ab-5ea58428b84b	\N	equipo	TOTEM	SERYSTILU	HILTON C2P2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
af9ed941-b41b-450f-b5fb-be68c61593ff	\N	equipo	TOTEM	VOGELS	SIN RUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ef419393-ed42-40ee-bc11-fc538b337126	\N	equipo	TOTEM MONITOR	VOGELS	T1844B	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ce218383-5c74-4742-a479-95552ea1e071	\N	equipo	TOTEM PANTALLA	DIMASA	FLEX -R	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4520791a-5e53-4ffe-a5c8-ff9680b856da	\N	equipo	TOTEM PANTALLA	FONESTAR	CONRUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
58020ea5-762c-475d-a8e1-19f232c10005	\N	equipo	TOTEM PANTALLA	INDETERMINADA	SINRUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6f4183c8-de22-4daf-9d91-b9adccd18159	\N	equipo	TOTEM PANTALLA	INDETERMINADO	CONRUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7924060d-1274-40d6-8788-05290f3d349f	\N	equipo	TOTEM PANTALLA	SERI STYLU	HILTON C2P2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
93c1e8d9-2c59-40f8-a56d-696b2b749389	\N	equipo	TOTEM PANTALLA	VOGEL	CON RUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b3abc672-58eb-49a6-baf9-2f24cfab3bf1	\N	equipo	TOTEM PANTALLA	VOGELS	FD2064S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
1697d6dc-8fbd-44e1-a02e-778a08a881d8	\N	equipo	TOTEM PANTALLA	VOGELS	PUC 2718S	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
571734e1-28e2-4eb9-9672-b3222c35993b	\N	equipo	TOTEM PANTALLA	VOGEL´S	PIE SIN RUEDAS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6f77dd58-2b58-4f0e-aa1f-c5a3da0f1816	\N	equipo	TRANSMISOR	EXTRON	DTP HDMI 4K 230 TX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ebf780a0-01f8-4dc5-acfa-e45710345a4b	\N	equipo	TRANSMISOR	SENNHEISER	BT T100	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
21661a7c-75b1-4d64-addf-3c763758edce	\N	equipo	TRANSMISOR AUDIO	EXTRON	HAE 100	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
0f3acd78-3c20-41ff-be0c-12ab30b033ca	\N	equipo	TRANSMISOR AUDIO	SHURE	SLXD1	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5787eca0-c354-4b12-b99c-aed072d4595d	\N	equipo	TRANSMISOR VIDEO	CRESTRON	DM-NVX 360	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
d591292d-2b54-4432-b595-8263f5811231	\N	equipo	TRANSMISOR VIDEO	CRESTRON	DM-NVX D363	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
354362ca-0064-4b65-8023-10e847886e54	\N	equipo	TRANSMISOR VIDEO	CRESTRON	DM-TRRX-100-STR	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
9db18d86-4d1e-4714-b448-c2242da229a6	\N	equipo	TRANSMISOR VIDEO	CRESTRON	HDRX101C-E	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
dad44182-4371-4a15-9e42-bc17e5696285	\N	equipo	TOTEM	DIMASA	MIF FLEX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
52f3c16f-65b5-48ca-a484-a47a9a66d441	\N	equipo	TOTEM	HILTON	C2P2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b9f01435-1476-40d8-8109-8d07da131de6	\N	equipo	TOTEM	NORTHBAYOU	AVA1500-60-1P	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
50409dbf-afc4-4d3e-a316-066a92bdad4e	\N	equipo	TOTEM PANTALLA	DIMASA	MIF-FLEX	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
856f4ed9-2299-4990-a880-32fec41eef6b	\N	equipo	TOTEM PIE CON RUEDAS	STYLU	HILTON C2P2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
c122d898-f295-41c3-9224-d2ec8545c06b	\N	equipo	UNIDAD CONTROL MICROFONIA	BOSCH	DCN - CCU LBB 4100/00	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
92132c0e-164a-4369-b65a-bb72d72d5e88	\N	equipo	UNIDAD CONTROL MICROFONIA	BOSCH	DCN-CCUB-2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2263ec67-e470-4e9d-9648-2fc312bc18f1	\N	equipo	UNIDAD CONTROL MICROFONIA	BOSCH	INT-TX08	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b51f54ba-2b5f-4db8-9c3e-291d4ef47ac3	\N	equipo	UNIDAD CONTROL MICROFONIA	BOSCH	LBB4402/00	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
61de0a18-5f1f-4192-b37a-baf460b1fdcc	\N	equipo	VIDEOCONFERENCIA	AVER	VB342	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
acaafd1e-7da0-4f6a-8104-3d92f948194c	\N	equipo	VIDEOCONFERENCIA	CISCO	BOARD 55	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
ab76e612-eb18-4283-80aa-a697bec0733c	\N	equipo	VIDEOCONFERENCIA	CISCO	BOARD PRO 55 G2	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
78483724-62d8-45f2-9b3e-a16c0b0cd888	\N	equipo	VIDEOCONFERENCIA	CISCO	CISCO CODEC PLUS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6e2192af-8093-4bf4-90f4-b976d3ce9e2c	\N	equipo	VIDEOCONFERENCIA	CISCO	CISCO IP CONFERENCE STATION 7937	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
af05c5a1-b464-4416-9159-1a97b6441f1c	\N	equipo	VIDEOCONFERENCIA	CISCO	CISCO ROOM BAR PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
fe9f774e-226d-4556-b2d4-0dd6a7b7b092	\N	equipo	VIDEOCONFERENCIA	CISCO	CS-DESKMINI-K9	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
00bd67f6-1636-426b-8d61-0112b3c48ab1	\N	equipo	VIDEOCONFERENCIA	CISCO	MX 300	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
cbbdc3e6-69e9-481f-b863-41ed1bdd668a	\N	equipo	VIDEOCONFERENCIA	CISCO	ROOM 55	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
b9c4f1b4-adb7-4da7-a140-c3f7970bd9eb	\N	equipo	VIDEOCONFERENCIA	CISCO	ROOMBAR PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
e33436d7-6a5e-4080-af03-cca288bdd3f4	\N	equipo	VIDEOCONFERENCIA	CISCO	SPARK ROOM KIT PLUS	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f035d029-e4b5-4c34-8efa-31f414428e7a	\N	equipo	VIDEOCONFERENCIA	CISCO	WEBEX BOARD PRO	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
7012ef58-333b-4f78-ba85-21dc14306a02	\N	equipo	VIDEOCONFERENCIA	CISCO	WEBEX ROOM 70 SINGLE	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
592ec03f-1155-411b-b8d4-8f45cb77a05a	\N	equipo	VIDEOCONFERENCIA	CRESTRON	UC-B30-T	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
2a0143e2-fd02-4ba9-b2bd-a1eb3edb3130	\N	equipo	VIDEOCONFERENCIA	CRESTRON	UC-SB1-CAM	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
28dfad82-e9ce-4976-a723-d663a9541ef1	\N	equipo	VIDEOCONFERENCIA	JABRA	PANACAST 50	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
3295fc7d-ebdf-445d-9d9b-0c136fb9c573	\N	equipo	VIDEOCONFERENCIA	LOGITECH	GRUPO LOGITECH	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
993ee4fd-7252-4742-b20e-c9519939f852	\N	equipo	VIDEOCONFERENCIA	YEALINK	MEETING BAR A40	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
4e4d5f12-61e9-49ec-9d17-32ea676ed344	\N	equipo	VIDEOCONFERENCIA	YEALINK	UVC85	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
31c47d2a-cefa-425c-aba6-d5d0f89dd7d8	\N	equipo	VIDEOWALL	UNILUMIN	SMD 1,5	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
5133881c-103a-4933-ac4a-d99fd2b44b31	\N	equipo	WEBCAM	LOGITECH	C 170	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
a01a852e-3b27-4655-8416-209ee035831f	\N	equipo	WEBCAM	LOGITECH	HD C920	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
73fb5696-f793-4e1e-b636-5b259fc0c13d	\N	equipo	WEBCAM	LOGITECH	PRO5000	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
78ad987b-e4aa-4f06-8e27-a2e8857c2d20	\N	equipo	WEBCAM	LOGITECH	QUICKCAM PRO 5000	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
f5e51f4f-47bd-4cec-9e28-d7b04117e581	\N	equipo	↳CONTROLADORA	CRESTRON	CP4N	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
6e3f7bd4-e336-4b85-a81a-a571cbafb507	\N	equipo	↳CONTROLADORA VW	DATAPATH	VSN1172	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
da8c9d13-add8-4c4e-99ac-f09d237cca3e	\N	equipo	↳TARJETA DANTE	QSC	CORE 24 F	\N	ud	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	t	2026-08-05 11:02:11.295603+00	\N	\N
982183e7-ad99-42dd-bfbf-503bb4361619	\N	cable	CABLE HDMI	\N	HDMI 2.0 4K60 4:4:4	Latiguillo HDMI alta velocidad con Ethernet, hasta 5 m sin repetidor	ud	\N	\N	\N	\N	\N	hdmi	HDMI A	HDMI A	{1.00,2.00,3.00,5.00,7.50,10.00,15.00}	\N	7.30	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
3db8244f-9f48-4b86-aceb-ecddbe671d0f	\N	cable	CABLE HDMI	\N	HDMI 2.1 48G	Latiguillo HDMI 8K, tiradas cortas de rack a pantalla	ud	\N	\N	\N	\N	\N	hdmi	HDMI A	HDMI A	{1.00,2.00,3.00,5.00}	\N	8.00	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
4cde640f-394c-4471-aeed-426bd5a7e48d	\N	cable	CABLE HDMI	\N	HDMI fibra optica activa	Para tiradas largas a proyector o pantalla lejana	ud	\N	\N	\N	\N	\N	hdmi	HDMI A	HDMI A	{10.00,15.00,20.00,30.00,50.00}	\N	4.80	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
9d6ec8df-4fa0-41ec-b6c7-b58914c35de0	\N	cable	CABLE RED	\N	Cat6 U/UTP LSZH	Cable de red a metros para tomas y equipos	m	\N	\N	\N	\N	\N	red	\N	\N	\N	305.00	5.50	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
c9517c90-d33c-4088-98ee-8160aa674c79	\N	cable	CABLE RED	\N	Cat6A F/UTP LSZH	Apantallado. Obligatorio para HDBaseT, Extron DTP y Dante	m	\N	\N	\N	\N	\N	red	\N	\N	\N	305.00	7.00	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
bffac042-44b5-4e54-a78d-562869fa4d10	\N	cable	CABLE RED	\N	Latiguillo Cat6A F/UTP	Latiguillo montado para rack y equipos	ud	\N	\N	\N	\N	\N	red	RJ45	RJ45	{0.50,1.00,2.00,3.00,5.00,10.00}	\N	7.00	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
4f513f22-8696-4289-9170-4aa93b31e455	\N	cable	CABLE USB	\N	USB-C 3.2 Gen2 100W	Conexion de portatil a dock o caja de conexiones	ud	\N	\N	\N	\N	\N	usb	USB-C	USB-C	{1.00,2.00,3.00}	\N	5.00	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
894db41b-5133-4403-9a4d-b00f2ee89f80	\N	cable	CABLE USB	\N	USB-A a USB-B activo	Camaras y barras de videoconferencia a mas de 5 m	ud	\N	\N	\N	\N	\N	usb	USB-A	USB-B	{5.00,10.00,15.00}	\N	5.50	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
086a830c-52d9-4173-aa20-cd018f3e4e03	\N	cable	CABLE AUDIO	\N	Altavoz 2x2,5 mm2 LSZH	Linea de altavoces de techo y pared	m	\N	\N	\N	\N	\N	audio_altavoz	\N	\N	\N	100.00	7.50	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
ad595ded-7e5f-4b69-8843-efdff2c9020a	\N	cable	CABLE AUDIO	\N	Altavoz 2x1,5 mm2 LSZH	Tiradas cortas de altavoz	m	\N	\N	\N	\N	\N	audio_altavoz	\N	\N	\N	100.00	6.20	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
8367ca27-9c60-44a0-92a4-f93dc35ac890	\N	cable	CABLE AUDIO	\N	Microfono 2x0,22 apantallado	Cable de senal balanceada a metros	m	\N	\N	\N	\N	\N	microfono	\N	\N	\N	100.00	5.00	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
36238be0-3a59-4401-89b9-2a147b753cb7	\N	cable	CABLE AUDIO	\N	Latiguillo XLR 3 pines	Microfonia y linea balanceada montada	ud	\N	\N	\N	\N	\N	microfono	XLR M	XLR H	{1.00,3.00,5.00,10.00,20.00}	\N	6.50	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
cc66c097-022f-4654-b3dc-c0d2d1756114	\N	cable	CABLE CONTROL	\N	RS-232 apantallado	Control de proyector y pantalla motorizada	m	\N	\N	\N	\N	\N	control	\N	\N	\N	100.00	4.50	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
1b13329c-100a-476f-b132-c73d371e639d	\N	cable	CABLE ALIMENTACION	\N	Manguera 3x1,5 mm2 LSZH	Alimentacion de pantalla, rack y puntos de techo	m	\N	\N	\N	\N	\N	alimentacion	\N	\N	\N	100.00	9.00	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
098c77ea-d384-4440-808c-0765cfb7f498	\N	cable	CABLE ALIMENTACION	\N	Latiguillo Schuko-IEC C13	Alimentacion de equipo de rack	ud	\N	\N	\N	\N	\N	alimentacion	Schuko	IEC C13	{0.50,1.00,2.00,3.00,5.00}	\N	7.00	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
fec9cae8-78fd-4b33-b723-e0d23fa0c5a9	\N	consumible	CONECTOR	\N	Conector RJ45 Cat6 UTP	Conector de campo	ud	\N	\N	\N	\N	\N	red	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
0ac138c8-3ebb-4aee-af94-f1e48ae3b712	\N	consumible	CONECTOR	\N	Conector RJ45 Cat6A FTP	Conector apantallado de campo	ud	\N	\N	\N	\N	\N	red	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
3fcbe168-cd32-414c-b814-3c1d11617342	\N	consumible	CONECTOR	\N	Conector XLR macho	\N	ud	\N	\N	\N	\N	\N	microfono	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
64dc4594-c6b8-4ff2-94d6-c43bd6a72402	\N	consumible	CONECTOR	\N	Conector XLR hembra	\N	ud	\N	\N	\N	\N	\N	microfono	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
9f82eda4-fb64-49e8-b103-9600f2e82c49	\N	consumible	CANALIZACION	\N	Canaleta 25x16 mm	Canaleta blanca con tapa	m	\N	\N	\N	\N	\N	otro	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
e2b1c5df-e523-4277-b3d4-acf55a560055	\N	consumible	CANALIZACION	\N	Canaleta 40x25 mm	Canaleta blanca con tapa	m	\N	\N	\N	\N	\N	otro	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
6c82fe85-0567-4716-97d7-fe265336f129	\N	consumible	CANALIZACION	\N	Canaleta 60x40 mm	Canaleta blanca con tapa	m	\N	\N	\N	\N	\N	otro	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
be245b17-30c6-44d8-9038-52a22ec04799	\N	consumible	CANALIZACION	\N	Tubo corrugado 20 mm	Tubo flexible libre de halogenos	m	\N	\N	\N	\N	\N	otro	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
fb87066e-52c9-4a45-8ac7-b36cea180af5	\N	consumible	CANALIZACION	\N	Tubo corrugado 25 mm	Tubo flexible libre de halogenos	m	\N	\N	\N	\N	\N	otro	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
07d58fa4-7537-44ce-b5b5-fe4f7cde5dea	\N	consumible	FIJACION	\N	Brida nylon 200 mm	\N	ud	\N	\N	\N	\N	\N	otro	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
6bab073d-81e1-4107-b17e-64602d030540	\N	consumible	FIJACION	\N	Grapa sujetacables	\N	ud	\N	\N	\N	\N	\N	otro	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
457651fc-2760-47cc-8613-a6dd3c105a02	\N	consumible	FIJACION	\N	Soporte pantalla VESA fijo 400x400	Para pantallas de 55 y 65 pulgadas	ud	\N	\N	\N	\N	\N	otro	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
9b4f07da-2f99-423b-96fd-3f28661abe9e	\N	consumible	FIJACION	\N	Soporte pantalla VESA inclinable 600x400	\N	ud	\N	\N	\N	\N	\N	otro	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
e9f4afeb-9ef0-4d7c-90c8-dba6c29eb6eb	\N	consumible	MECANISMO	\N	Caja de superficie 2 modulos	\N	ud	\N	\N	\N	\N	\N	otro	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
d3245ddc-72f6-4299-b20c-0702178ac987	\N	consumible	MECANISMO	\N	Placa HDMI + RJ45 empotrable	Placa de pared para toma de sala	ud	\N	\N	\N	\N	\N	otro	\N	\N	\N	\N	\N	\N	t	2026-08-05 11:02:11.295603+00	\N	\N
3f843d00-ee55-40b7-86ca-b4374462b66e	\N	equipo	VIDEOCONFERENCIA	CISCO	SPARK ROOM KIT	Kit de videoconferencia integrado para sala mediana	ud	4200.0000	5100.0000	0138ad60-a821-40dd-bc40-7ad2ab7d95e9	21	\N	\N	\N	\N	\N	\N	\N	285	t	2026-08-05 11:02:11.295603+00	Cámara 5K con encuadre automático\r\nMicrófonos integrados\r\n1x HDMI entrada, 1x HDMI salida\r\nPoE+ o alimentación externa\r\nMontaje sobre pantalla o pared	Convive mal con el Touch 10 antiguo. Emparejar siempre con Room Navigator.
\.


--
-- Data for Name: conexiones; Type: TABLE DATA; Schema: public; Owner: av_design
--

COPY public.conexiones (id, sala_id, origen_id, destino_id, articulo_cable_id, senal, ruta, longitud_manual_m, notas) FROM stdin;
28beb585-b680-49aa-a789-d4c5e2addd8d	18649278-37c5-4d5f-9d2c-9dd0dcca0763	b4d6e799-da61-4228-9fe7-bdd8c8c612d3	847ad76b-65d8-4c14-9ccc-57fdb64dc933	982183e7-ad99-42dd-bfbf-503bb4361619	hdmi	\N	\N	\N
\.


--
-- Data for Name: parametros; Type: TABLE DATA; Schema: public; Owner: av_design
--

COPY public.parametros (clave, valor, unidad, descripcion) FROM stdin;
holgura_pantalla	0.3500	m	Holgura en el extremo que acaba en pantalla (rango 0,20–0,50)
holgura_proyector	0.1000	m	Holgura en el extremo que acaba en proyector
holgura_rack	1.0000	m	Holgura en el extremo que acaba en rack
holgura_caja_conexiones	0.5000	m	Holgura en caja de conexiones de mesa
holgura_mesa	0.5000	m	Holgura en toma de mesa
holgura_techo	0.3000	m	Holgura en altavoz o micrófono de techo
holgura_pared	0.3000	m	Holgura en toma o placa de pared
margen	0.0000	tanto por uno	Margen de seguridad sobre el total. 0 = ninguno
cables_por_canalizacion	3.0000	ud	El previsto más un RJ45 y un HDMI de reserva
ocupacion_maxima_canaleta	0.4000	tanto por uno	Ocupación máxima admitida en canaleta
\.


--
-- Data for Name: plantilla_articulos; Type: TABLE DATA; Schema: public; Owner: av_design
--

COPY public.plantilla_articulos (id, plantilla_id, articulo_id, categoria, modelo_texto, cantidad, opcional) FROM stdin;
4bf4f599-ecef-458c-9fc7-03af04f15fd9	57b9eca9-2691-4bc8-a020-8373d6de74b7	\N	CAJA CONEXIONES	AMX	1.00	f
1fe645d6-3158-4cdd-9e1c-f9d19abd25c6	553b2b22-339f-4375-8427-6b8946537101	\N	CAJA CONEXIONES	AMX	1.00	t
ab26b20f-db92-4329-a6a7-d16008185471	eea64ad6-2b90-4972-bb81-87d09c39ab00	\N	CAJA CONEXIONES	AMX	1.00	f
d78c1e8b-ec83-4d26-a9f1-7f1fd56d9a55	45792686-c88c-44ff-8bd7-31d1233d94e2	\N	CAJA CONEXIONES	AMX	1.00	t
3bd1347c-5d04-44a8-a8ff-40706ab3a1ee	57b9eca9-2691-4bc8-a020-8373d6de74b7	c1629983-8c08-44d2-85f1-99555313fc96	PANTALLA	SAMSUNG QB65R-B	1.00	f
f7623113-02a2-47b6-9a53-445ab35d3d65	45792686-c88c-44ff-8bd7-31d1233d94e2	c1629983-8c08-44d2-85f1-99555313fc96	PANTALLA	SAMSUNG QB65R-B	1.00	f
3f349b27-10f7-4757-9f31-1bf5a8f7e56a	6592b157-d35c-4e0b-b684-379673a70a78	c1629983-8c08-44d2-85f1-99555313fc96	PANTALLA	SAMSUNG QB65R-B	1.00	f
52f4da54-f38b-4659-852d-d2c14fe30f30	2ef0de75-05c0-4731-bb13-a142a13bc6d8	c1629983-8c08-44d2-85f1-99555313fc96	PANTALLA	SAMSUNG QB65R-B	1.00	f
2df72a70-74e3-4931-a04c-aa43379f15eb	553b2b22-339f-4375-8427-6b8946537101	c1629983-8c08-44d2-85f1-99555313fc96	PANTALLA	SAMSUNG QB65R-B	2.00	f
6091e0bb-89b3-4ac6-aefb-422712c29601	eea64ad6-2b90-4972-bb81-87d09c39ab00	c1629983-8c08-44d2-85f1-99555313fc96	PANTALLA	SAMSUNG QB65R-B	2.00	f
74c0ef2b-6023-49e4-8a5d-ace0c2428dd8	dd656664-3cd9-4ac9-9836-e6532752cd92	c1629983-8c08-44d2-85f1-99555313fc96	PANTALLA	SAMSUNG QB65R-B	2.00	f
e3bcd5a4-2da6-4253-96b0-2b15bf5a3f51	b33f0166-2042-495d-bba2-96765bf9ed0c	70f2b6fc-48bf-4e03-8612-be802002ea89	ALTAVOZ	BOSE FREESPACE DS100F	3.00	f
6540dbed-00c7-46cf-aec1-97021eb29880	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	70f2b6fc-48bf-4e03-8612-be802002ea89	ALTAVOZ	BOSE FREESPACE DS100F	3.00	f
114e8278-123a-4389-bbd0-e848770db3c8	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	3bea5108-5c06-45dc-bcc4-678e8e3752ff	PANEL TACTIL	CISCO CISCO ROOM NAVIGATOR	2.00	f
69a445ea-1da6-4a39-b178-12e6d66d0d92	dd656664-3cd9-4ac9-9836-e6532752cd92	3bea5108-5c06-45dc-bcc4-678e8e3752ff	PANEL TACTIL	CISCO CISCO ROOM NAVIGATOR	1.00	f
4dbf33ec-c7b0-45d0-ab58-b876df3ef1d5	b33f0166-2042-495d-bba2-96765bf9ed0c	3bea5108-5c06-45dc-bcc4-678e8e3752ff	PANEL TACTIL	CISCO CISCO ROOM NAVIGATOR	2.00	f
cde88365-7ae7-4ea2-8b6f-fbbed4ed1fd1	45792686-c88c-44ff-8bd7-31d1233d94e2	3bea5108-5c06-45dc-bcc4-678e8e3752ff	PANEL TACTIL	CISCO CISCO ROOM NAVIGATOR	1.00	f
ebf1db5c-37eb-45a8-b93e-7a1691d52e96	eea64ad6-2b90-4972-bb81-87d09c39ab00	3bea5108-5c06-45dc-bcc4-678e8e3752ff	PANEL TACTIL	CISCO CISCO ROOM NAVIGATOR	1.00	f
a09136b9-5246-42f1-ad95-8a069b3318ec	553b2b22-339f-4375-8427-6b8946537101	3bea5108-5c06-45dc-bcc4-678e8e3752ff	PANEL TACTIL	CISCO CISCO ROOM NAVIGATOR	1.00	f
0c17871b-b780-4af4-9051-ede3ee377d4b	c4ce7fa1-b03e-4442-82d8-c4e4408ce660	3bea5108-5c06-45dc-bcc4-678e8e3752ff	PANEL TACTIL	CISCO CISCO ROOM NAVIGATOR	1.00	f
06d5aece-5f2e-4e7f-acfd-ee4ec796bde8	57b9eca9-2691-4bc8-a020-8373d6de74b7	3bea5108-5c06-45dc-bcc4-678e8e3752ff	PANEL TACTIL	CISCO CISCO ROOM NAVIGATOR	1.00	f
78a6068f-cd04-4594-870b-1986392fafc0	45792686-c88c-44ff-8bd7-31d1233d94e2	3f843d00-ee55-40b7-86ca-b4374462b66e	VIDEOCONFERENCIA	CISCO SPARK ROOM KIT	1.00	f
c03606a4-30b7-4e37-b3ab-11eaec25327d	c4ce7fa1-b03e-4442-82d8-c4e4408ce660	3f843d00-ee55-40b7-86ca-b4374462b66e	VIDEOCONFERENCIA	CISCO SPARK ROOM KIT	1.00	f
4cae4144-bcd7-4e32-b8a6-ca4f159e5914	57b9eca9-2691-4bc8-a020-8373d6de74b7	3f843d00-ee55-40b7-86ca-b4374462b66e	VIDEOCONFERENCIA	CISCO SPARK ROOM KIT	1.00	f
ad8b56d2-4f95-480c-ba12-36c0cc11f83b	dd656664-3cd9-4ac9-9836-e6532752cd92	446929ed-548d-4114-97ec-07ed6cc11345	MICROFONO	CISCO TABLE MICROPHONE MINI JACK (V1)	1.00	f
4cd2752f-0dac-4d29-95cf-219f9d26005d	45792686-c88c-44ff-8bd7-31d1233d94e2	446929ed-548d-4114-97ec-07ed6cc11345	MICROFONO	CISCO TABLE MICROPHONE MINI JACK (V1)	1.00	f
dbdda0cd-f80e-4bd5-bf20-71cc33111ae5	eea64ad6-2b90-4972-bb81-87d09c39ab00	446929ed-548d-4114-97ec-07ed6cc11345	MICROFONO	CISCO TABLE MICROPHONE MINI JACK (V1)	2.00	f
7be52d3a-d989-49bb-b7fc-e321ab7fe970	553b2b22-339f-4375-8427-6b8946537101	446929ed-548d-4114-97ec-07ed6cc11345	MICROFONO	CISCO TABLE MICROPHONE MINI JACK (V1)	1.00	f
9cdb43e6-778b-4cd2-b562-426ec399493b	c4ce7fa1-b03e-4442-82d8-c4e4408ce660	446929ed-548d-4114-97ec-07ed6cc11345	MICROFONO	CISCO TABLE MICROPHONE MINI JACK (V1)	1.00	t
cd176e01-b5a2-420d-af80-8f051cc22866	57b9eca9-2691-4bc8-a020-8373d6de74b7	446929ed-548d-4114-97ec-07ed6cc11345	MICROFONO	CISCO TABLE MICROPHONE MINI JACK (V1)	1.00	t
f187c950-887f-4ba3-a4bb-aebed5077b02	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	def46737-7da9-4124-9a45-8489c73228e9	CAJA CONEXIONES	BACHMANN TOPFRAME	3.00	f
33e71aa7-4543-423e-9fb8-ba8c81293509	dd656664-3cd9-4ac9-9836-e6532752cd92	def46737-7da9-4124-9a45-8489c73228e9	CAJA CONEXIONES	BACHMANN TOPFRAME	1.00	f
f9bdcf57-ffb0-428f-be22-d343a5fc2fe9	b33f0166-2042-495d-bba2-96765bf9ed0c	def46737-7da9-4124-9a45-8489c73228e9	CAJA CONEXIONES	BACHMANN TOPFRAME	1.00	t
e9379cf7-3888-451c-9912-44ffd1c65231	c4ce7fa1-b03e-4442-82d8-c4e4408ce660	def46737-7da9-4124-9a45-8489c73228e9	CAJA CONEXIONES	BACHMANN TOPFRAME	1.00	t
8b176e5b-7d05-4814-ac21-b5a9c4ca2dad	553b2b22-339f-4375-8427-6b8946537101	53d2a806-98b5-471d-865e-824cda6960de	VIDEOCONFERENCIA	CISCO WEBEX ROOM BAR PRO	1.00	f
b1fc6df3-7484-4905-9297-9d91053bb1f4	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	8045bab6-d5ff-498a-ac27-68592f8778be	MICROFONO	CISCO TABLE MICROPHONE MINI JACK (V2)	2.00	f
eac40e53-6188-4c42-956f-59cc4bd7b447	c4ce7fa1-b03e-4442-82d8-c4e4408ce660	c1833fd8-0d5a-4601-8baa-1176d89b18c5	PANTALLA	SAMSUNG QB55R-B	1.00	f
34cc5c1c-43df-433d-94c6-d92b671697c5	062ea96d-e979-4893-be42-35a3b0ed1f6b	c1833fd8-0d5a-4601-8baa-1176d89b18c5	PANTALLA	SAMSUNG QB55R-B	1.00	f
5af697e0-d8ac-4e7f-8d3c-b1062e909e31	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	a0bb7536-8a27-4ef0-936b-b2f911bbe359	RECEPTOR VIDEO	EXTRON DTP HDMI 4K 230 RX	1.00	f
bf8744b6-788f-4bad-b2a3-d4916dc41ad3	b33f0166-2042-495d-bba2-96765bf9ed0c	a0bb7536-8a27-4ef0-936b-b2f911bbe359	RECEPTOR VIDEO	EXTRON DTP HDMI 4K 230 RX	3.00	f
87466b90-474e-453b-8e01-8d9b72eee985	b33f0166-2042-495d-bba2-96765bf9ed0c	e6bedede-cd5a-464b-b25a-6ace15764e0e	MICROFONO	BOSCH CONCENTRUS	11.00	f
c6a528d6-fef0-4072-9b46-53ec01e66c91	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	88f53305-78b5-4b5f-be72-65eefa0935bd	PANTALLA ROOMWIZARD	STEELCASE ROOMWIZARD II	1.00	t
697236b3-12aa-4728-acc9-70382f6247c8	dd656664-3cd9-4ac9-9836-e6532752cd92	88f53305-78b5-4b5f-be72-65eefa0935bd	PANTALLA ROOMWIZARD	STEELCASE ROOMWIZARD II	1.00	t
65d60540-6abd-4173-a0fc-653deb206ddf	b33f0166-2042-495d-bba2-96765bf9ed0c	88f53305-78b5-4b5f-be72-65eefa0935bd	PANTALLA ROOMWIZARD	STEELCASE ROOMWIZARD II	1.00	t
15e86248-8954-4380-9be1-279a2eb7a230	6592b157-d35c-4e0b-b684-379673a70a78	88f53305-78b5-4b5f-be72-65eefa0935bd	PANTALLA ROOMWIZARD	STEELCASE ROOMWIZARD II	1.00	t
d97094d4-6c19-4d2d-8a3e-9d534b29c6b8	2ef0de75-05c0-4731-bb13-a142a13bc6d8	88f53305-78b5-4b5f-be72-65eefa0935bd	PANTALLA ROOMWIZARD	STEELCASE ROOMWIZARD II	1.00	t
9e5a3953-d79e-4d32-ada3-86f59ca11d9a	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	c32a4170-da46-4ed2-af6d-ecc73242d2ff	TRANSMISOR VIDEO	EXTRON DTP HDMI 4K 230 TX	2.00	f
e7bffa43-cbfb-4f2b-9de4-65927eedab7e	b33f0166-2042-495d-bba2-96765bf9ed0c	c32a4170-da46-4ed2-af6d-ecc73242d2ff	TRANSMISOR VIDEO	EXTRON DTP HDMI 4K 230 TX	3.00	f
22e33da8-baf4-44a0-a69f-94f94e661b26	37e92d4c-9cf5-4b9f-8311-2a45893c47ab	9b1a61fc-b81c-4b71-a982-a0f1261d4b85	PC	LENOVO THINKCENTRE M920Q	1.00	t
ab8c33a5-975f-4735-b140-682ecf69232c	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	68fe9a22-ca41-4023-875b-94da9c3d5cd5	CAMARA	CISCO QUAD CAMERA	2.00	f
8216a08c-79cd-4061-b8e8-6233680b6002	dd656664-3cd9-4ac9-9836-e6532752cd92	68fe9a22-ca41-4023-875b-94da9c3d5cd5	CAMARA	CISCO QUAD CAMERA	1.00	t
120706ed-338e-496f-b5d4-903ae9ac9ebd	eea64ad6-2b90-4972-bb81-87d09c39ab00	68fe9a22-ca41-4023-875b-94da9c3d5cd5	CAMARA	CISCO QUAD CAMERA	1.00	t
c9049c55-3d26-4911-bcff-8e06d17666f3	45792686-c88c-44ff-8bd7-31d1233d94e2	9ac8ffdb-3d98-4f9f-8a29-cd2f8bedb218	DOCK STATION	TARGUS DOCK182	1.00	t
b0a10efa-1e37-474b-9cd8-3070f6316393	3a325669-e0d8-4ed9-90e3-3723c41f4188	9ac8ffdb-3d98-4f9f-8a29-cd2f8bedb218	DOCK STATION	TARGUS DOCK182	1.00	t
c2dd80f7-3c81-436c-acdd-670842c54067	f281f82a-ad54-42f9-b748-f878be398665	9ac8ffdb-3d98-4f9f-8a29-cd2f8bedb218	DOCK STATION	TARGUS DOCK182	1.00	f
4e9919b6-3ab4-4930-9aff-c6cb45bc767a	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	ae6cf345-f2ad-48a7-8d3f-9fbfe2897591	VIDEOCONFERENCIA	CISCO WEBEX ROOM EQ	1.00	f
369165b2-d329-42a3-889a-ceb2b1bdac64	dd656664-3cd9-4ac9-9836-e6532752cd92	ae6cf345-f2ad-48a7-8d3f-9fbfe2897591	VIDEOCONFERENCIA	CISCO WEBEX ROOM EQ	1.00	f
f3f4eb57-ac1e-4377-8465-1b72939de131	b33f0166-2042-495d-bba2-96765bf9ed0c	ae6cf345-f2ad-48a7-8d3f-9fbfe2897591	VIDEOCONFERENCIA	CISCO WEBEX ROOM EQ	1.00	f
228709ae-0fd0-4282-99a5-17cdf0512fb3	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	bce7e987-862a-4ed6-870f-ec7dae9aafb3	MONITOR	ARTHUR HOLM AH19DX216GA2M2P	4.00	f
2257b1b3-b2bc-4f43-b80a-68435be6ede8	b33f0166-2042-495d-bba2-96765bf9ed0c	2d901a50-20d4-46ff-b119-e32aab6d2932	PROYECTOR	EPSON EB-L630U	1.00	f
03c8e4db-e5f5-42ce-8def-8e4bfe97d99b	eea64ad6-2b90-4972-bb81-87d09c39ab00	dec3c8a7-882e-40d1-8315-03fb21c671c2	VIDEOCONFERENCIA	CISCO WEBEX ROOM EQ QUADCAM	1.00	f
e23e0a8b-b4dd-482b-9881-633e74c3e738	b33f0166-2042-495d-bba2-96765bf9ed0c	25875784-88e3-464c-8488-97f9dd506e9a	MONITOR	ALBIRAL AH17TXHDGA	3.00	f
826d4658-42bc-48f9-b707-1373827379f7	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	cc7c1ff9-92cc-481e-a4ac-897eb3137da2	PANTALLA	SAMSUNG QB65B	1.00	t
1f02ad70-014a-4dae-be77-7c1aa553583a	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	181e7fd3-e357-428c-8fef-1d5de339fc2e	EXTENSOR	CRESTRON HD-TXU-4KZ-211-CHGR	2.00	f
bd10b0c0-cf8e-45ef-86be-a8dde02eea47	b33f0166-2042-495d-bba2-96765bf9ed0c	181e7fd3-e357-428c-8fef-1d5de339fc2e	EXTENSOR	CRESTRON HD-TXU-4KZ-211-CHGR	2.00	f
789ade9a-aed0-4d9f-a9f8-e69594d538b2	f281f82a-ad54-42f9-b748-f878be398665	8484b0a0-81e7-4157-ad07-acce33ddbff7	PANTALLA	SAMSUNG QM32R-B	1.00	f
cf2ac6a9-079e-4073-8157-275ed948867e	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	ad35c83f-1054-4b20-98d7-00cb9fa95705	CONTROLADORA	CRESTRON RMC4	1.00	t
d41add08-4b33-40c2-991d-5c9d0530ebf3	b33f0166-2042-495d-bba2-96765bf9ed0c	ad35c83f-1054-4b20-98d7-00cb9fa95705	CONTROLADORA	CRESTRON RMC4	1.00	t
09f820ee-4cbe-4d81-ad30-1c0eb8d24b0a	3a325669-e0d8-4ed9-90e3-3723c41f4188	861f89bd-0ec5-40ca-a1d0-918f9d4ca0f4	PANTALLA	SONY FW - 65X8570C	2.00	f
e80ae871-cef8-4418-8560-8f0353da529f	b33f0166-2042-495d-bba2-96765bf9ed0c	35121c5b-920e-4f0a-be36-39135c5a3893	CAMARA	SONY SRG-X400	2.00	f
d9e3bcc7-aeb2-493a-9397-071e9c27787d	45792686-c88c-44ff-8bd7-31d1233d94e2	09c2697c-119c-4330-8d7c-54b9bdb535f9	MATRIZ	LIGHTWARE UCX-4X2-HC30	1.00	t
3697cc7d-47a2-4955-8b7c-456fbff5a29e	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	c03837a2-b31d-4f9b-8818-76bd881ca75c	PC	HP PRODESK 600 G4	1.00	t
feb256f9-f0c5-4964-8af6-8ee9ec0b3f58	b33f0166-2042-495d-bba2-96765bf9ed0c	c03837a2-b31d-4f9b-8818-76bd881ca75c	PC	HP PRODESK 600 G4	1.00	f
99d6461c-ef2f-4af2-9316-e912b4b9b07b	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	30a13605-9f69-4d5a-a613-2091f5ed9b8f	AMPLIFICADOR	BITTNER BASIC 400	1.00	t
c6790ab1-2ae8-4a3b-a826-bcdfe73459bc	b33f0166-2042-495d-bba2-96765bf9ed0c	30a13605-9f69-4d5a-a613-2091f5ed9b8f	AMPLIFICADOR	BITTNER BASIC 400	1.00	f
1d6e084a-c452-4618-ba44-79dcc987682b	37e92d4c-9cf5-4b9f-8311-2a45893c47ab	63cd6b49-80c2-4543-9915-1cd457a43a50	PANTALLA	SAMSUNG DM65E	1.00	f
69372f6f-601a-40e1-a8ff-5c2cf7ba8bf6	b33f0166-2042-495d-bba2-96765bf9ed0c	dca05036-74dc-4a16-8c61-b150ba6f65ed	PANTALLA	SAMSUNG QB55C	1.00	f
b59b2cc6-7a71-4b23-9167-99895909720c	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	331f049a-0ae4-49da-810a-8b5993ac3e21	UNIDAD CONTROL MICROFONIA	BOSCH DCN-CCU2	1.00	f
2f73a6fd-c5f8-44c9-91f7-a92dfaee8c55	b33f0166-2042-495d-bba2-96765bf9ed0c	331f049a-0ae4-49da-810a-8b5993ac3e21	UNIDAD CONTROL MICROFONIA	BOSCH DCN-CCU2	1.00	f
931e534e-6bbc-4d4f-9e4d-74ec8dd12f5c	f281f82a-ad54-42f9-b748-f878be398665	776bc63a-be0a-418e-9085-b747e75aaed7	WEBCAM	JABRA PANACAST	1.00	t
338667bc-f17a-4f6b-b853-687820b8fc1c	b33f0166-2042-495d-bba2-96765bf9ed0c	98b49494-a719-404b-aa99-35fb88382755	BASE CARGA MICROFONO	SHURE SBC203	1.00	t
8ceeea40-655b-4684-8d83-37d2ccc4db5d	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	9ba319d9-f6c5-44c8-951d-c97bb6d05d51	DISTRIBUIDOR	CRESTRON HD-DA8-4KZ-E	1.00	t
9efc879a-1be2-4440-8223-99664cd31aef	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	c22f7e6b-9dff-44cf-a228-30a4f75774be	AMINO	TRIPLEPAY TPS-SPI-4	1.00	t
65a475a4-6886-4364-bc49-8b3295b92178	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	a7f71cc1-3ab7-4734-99ab-0e5ba8b446b4	MATRIZ	EXTRON DTP CROSSPOINT 108	1.00	t
ea768c8c-329e-4e3c-afa4-995ad9a588bd	b33f0166-2042-495d-bba2-96765bf9ed0c	a7f71cc1-3ab7-4734-99ab-0e5ba8b446b4	MATRIZ	EXTRON DTP CROSSPOINT 108	1.00	t
71b41a88-873c-4d6e-ac50-de8a8fbe67f5	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	df09d471-20c4-4e23-80d5-9b24af905a8f	PASARELA	CRESTRON HD-CTL-101	1.00	t
88583218-c863-469f-8825-f5b11f089f69	b33f0166-2042-495d-bba2-96765bf9ed0c	df09d471-20c4-4e23-80d5-9b24af905a8f	PASARELA	CRESTRON HD-CTL-101	1.00	t
a47e0f78-9be0-4f90-827d-af93907b9cf1	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	ac1c0b4a-90d2-4d49-9c0e-4d275aa794c9	RECEPTOR MICROFONO	SENNHEISER EM2050 558-626 MHZ	1.00	t
06c7bd7b-fae7-44e4-9c2b-e9feacc7399c	b33f0166-2042-495d-bba2-96765bf9ed0c	cd61d2e6-6536-4c9f-a74c-abb9f3f6d190	RECEPTOR MICROFONO	SHURE SLXD4D	1.00	t
2ae73708-ddd7-4142-84a0-3ec6feff919d	c19d26cf-548d-4fcb-8f81-a693dc0b3335	3279cbb3-8f4b-46ed-befe-bfd9d4391860	PANTALLA	SAMSUNG DM82D	1.00	f
8edba615-082e-42a6-9ef4-79e0152f5ff7	37e92d4c-9cf5-4b9f-8311-2a45893c47ab	08b0d3b6-c530-4ef0-9713-0182c3e36667	TOTEM	VOGEL'S FD 2064 S TOTEM	1.00	f
a6cfdb4a-dcbe-4910-b49e-460bff333667	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	2153570e-542d-40ec-918b-4bf50fc13204	PROCESADOR AUDIO	BIAMP TESIRA FORTE CI	1.00	t
87ff1d6c-1ae8-4c95-b8dd-381475d1a25a	2fd0277c-b9b1-47e1-8168-aacb73420d85	11263d6c-3a82-434b-9b3a-1784969e04fd	VIDEOCONFERENCIA	CISCO CS-DESK-K9	1.00	f
5e4ac2f8-3181-4400-b2eb-0fdaca4fcc4b	c19d26cf-548d-4fcb-8f81-a693dc0b3335	7aa4301a-3092-4b5a-bc1d-613152d394a1	CONTROLADORA	LG CVBA	1.00	t
361a9e00-68b5-458f-8c5b-1678b71d28b5	c19d26cf-548d-4fcb-8f81-a693dc0b3335	eeaa14cd-e42c-43b3-a03f-671752bfc12d	EXPANSOR	AMX AMX EXB-COM2	1.00	t
3c042bd5-7068-4143-875c-138f7a18d245	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	8d8da373-cf55-456c-b2c0-e0cf13b979d5	MULTIVENTANA	CRESTRON HD-WP-4K-401-C	1.00	t
fcc871ba-2e36-40dd-b999-c529f13bef83	c19d26cf-548d-4fcb-8f81-a693dc0b3335	7bffb533-4bdd-483a-b1ce-1ba785fabf82	PC	HP ELITE DESK 800 G5	1.00	f
6468cabf-0cc5-405e-ba6c-1d9adc3f9303	b33f0166-2042-495d-bba2-96765bf9ed0c	3615a231-ef96-4224-ae41-7ec8569d07ab	PROCESADOR AUDIO	BIAMP TESIRAFORTÉ CI	1.00	t
b5de18db-ff60-4cbf-a09d-ce3405c91247	74d6fc10-735a-4e11-9dc5-ea6a72b780a8	b2093e1b-eb8e-483b-a707-bd1df2aae394	PROYECTOR	SONY VPL-FHZ700L	1.00	t
\.


--
-- Data for Name: plantillas_sala; Type: TABLE DATA; Schema: public; Owner: av_design
--

COPY public.plantillas_sala (id, nombre, tipologia, aforo, n_salas_reales, largo_m, ancho_m, alto_m, alto_falso_techo_m, ruta_por_defecto, notas, creado_en) FROM stdin;
062ea96d-e979-4893-be42-35a3b0ed1f6b	ULTRALIGERA QR · aforo 4	ULTRALIGERA QR	4	55	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
c4ce7fa1-b03e-4442-82d8-c4e4408ce660	SALA TP · aforo 4	SALA TP	4	32	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
2ef0de75-05c0-4731-bb13-a142a13bc6d8	ULTRALIGERA QR · aforo 6	ULTRALIGERA QR	6	22	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
553b2b22-339f-4375-8427-6b8946537101	FIJA TP · aforo 10	FIJA TP	10	22	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
37e92d4c-9cf5-4b9f-8311-2a45893c47ab	TOTEM	TOTEM	\N	18	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
f281f82a-ad54-42f9-b748-f878be398665	LIGERA · aforo 3	LIGERA	3	15	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
6592b157-d35c-4e0b-b684-379673a70a78	ULTRALIGERA QR · aforo 8	ULTRALIGERA QR	8	15	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
3a325669-e0d8-4ed9-90e3-3723c41f4188	LIGERA	LIGERA	\N	9	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
eea64ad6-2b90-4972-bb81-87d09c39ab00	FIJA TP · aforo 14	FIJA TP	14	8	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
45792686-c88c-44ff-8bd7-31d1233d94e2	SALA TP · aforo 6	SALA TP	6	6	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
b33f0166-2042-495d-bba2-96765bf9ed0c	VIP · aforo 24	VIP	24	5	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
dd656664-3cd9-4ac9-9836-e6532752cd92	SALA TP · aforo 12	SALA TP	12	5	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
74d6fc10-735a-4e11-9dc5-ea6a72b780a8	VIP · aforo 16	VIP	16	4	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
2fd0277c-b9b1-47e1-8168-aacb73420d85	SALA TP · aforo 3	SALA TP	3	3	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
c19d26cf-548d-4fcb-8f81-a693dc0b3335	VIDEOWALL	VIDEOWALL	\N	3	\N	\N	\N	\N	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
57b9eca9-2691-4bc8-a020-8373d6de74b7	SALA TP · aforo 8	SALA TP	8	144	6.00	4.00	3.00	2.70	falso_techo	Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.	2026-08-05 11:02:11.295603+00
\.


--
-- Data for Name: proveedores; Type: TABLE DATA; Schema: public; Owner: av_design
--

COPY public.proveedores (id, nombre, contacto, email, telefono, notas) FROM stdin;
0138ad60-a821-40dd-bc40-7ad2ab7d95e9	Charmex	\N	\N	\N	\N
\.


--
-- Data for Name: sala_equipos; Type: TABLE DATA; Schema: public; Owner: av_design
--

COPY public.sala_equipos (id, sala_id, articulo_id, nombre, cantidad, extremo, x_m, y_m, z_m) FROM stdin;
b4d6e799-da61-4228-9fe7-bdd8c8c612d3	18649278-37c5-4d5f-9d2c-9dd0dcca0763	c1629983-8c08-44d2-85f1-99555313fc96	SAMSUNG QB65R-B	1	pantalla	3.00	0.00	1.50
847ad76b-65d8-4c14-9ccc-57fdb64dc933	18649278-37c5-4d5f-9d2c-9dd0dcca0763	\N	AMX	1	caja_conexiones	3.00	2.00	0.75
c86d249e-04fe-4ada-a7e1-59521bafb260	18649278-37c5-4d5f-9d2c-9dd0dcca0763	3bea5108-5c06-45dc-bcc4-678e8e3752ff	CISCO CISCO ROOM NAVIGATOR	1	mesa	3.00	1.80	0.75
0343b54c-1631-466a-b350-d92bcc98a723	18649278-37c5-4d5f-9d2c-9dd0dcca0763	3f843d00-ee55-40b7-86ca-b4374462b66e	CISCO SPARK ROOM KIT	1	pared	3.00	0.30	1.10
\.


--
-- Data for Name: salas; Type: TABLE DATA; Schema: public; Owner: av_design
--

COPY public.salas (id, sede_id, edificio, nivel, codigo, nombre, tipologia, aforo, plantilla_id, largo_m, ancho_m, alto_m, alto_falso_techo_m, alto_canaleta_m, alto_suelo_tecnico_m, ruta_por_defecto, notas, creado_en, actualizado_en) FROM stdin;
18649278-37c5-4d5f-9d2c-9dd0dcca0763	\N	\N	\N	\N	África 001	SALA TP	8	57b9eca9-2691-4bc8-a020-8373d6de74b7	6.00	4.00	3.00	2.70	0.30	0.00	falso_techo	\N	2026-08-05 11:06:11.954849+00	2026-08-05 11:06:11.954849+00
\.


--
-- Data for Name: sedes; Type: TABLE DATA; Schema: public; Owner: av_design
--

COPY public.sedes (id, nombre, ciudad, notas) FROM stdin;
\.


--
-- Name: articulos articulos_pkey; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.articulos
    ADD CONSTRAINT articulos_pkey PRIMARY KEY (id);


--
-- Name: articulos articulos_referencia_key; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.articulos
    ADD CONSTRAINT articulos_referencia_key UNIQUE (referencia);


--
-- Name: conexiones conexiones_pkey; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.conexiones
    ADD CONSTRAINT conexiones_pkey PRIMARY KEY (id);


--
-- Name: parametros parametros_pkey; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.parametros
    ADD CONSTRAINT parametros_pkey PRIMARY KEY (clave);


--
-- Name: plantilla_articulos plantilla_articulos_pkey; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.plantilla_articulos
    ADD CONSTRAINT plantilla_articulos_pkey PRIMARY KEY (id);


--
-- Name: plantillas_sala plantillas_sala_nombre_key; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.plantillas_sala
    ADD CONSTRAINT plantillas_sala_nombre_key UNIQUE (nombre);


--
-- Name: plantillas_sala plantillas_sala_pkey; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.plantillas_sala
    ADD CONSTRAINT plantillas_sala_pkey PRIMARY KEY (id);


--
-- Name: proveedores proveedores_nombre_key; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_nombre_key UNIQUE (nombre);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: sala_equipos sala_equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.sala_equipos
    ADD CONSTRAINT sala_equipos_pkey PRIMARY KEY (id);


--
-- Name: salas salas_pkey; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_pkey PRIMARY KEY (id);


--
-- Name: sedes sedes_nombre_key; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.sedes
    ADD CONSTRAINT sedes_nombre_key UNIQUE (nombre);


--
-- Name: sedes sedes_pkey; Type: CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.sedes
    ADD CONSTRAINT sedes_pkey PRIMARY KEY (id);


--
-- Name: articulos_categoria_idx; Type: INDEX; Schema: public; Owner: av_design
--

CREATE INDEX articulos_categoria_idx ON public.articulos USING btree (categoria);


--
-- Name: articulos_tipo_idx; Type: INDEX; Schema: public; Owner: av_design
--

CREATE INDEX articulos_tipo_idx ON public.articulos USING btree (tipo);


--
-- Name: articulos_unico_idx; Type: INDEX; Schema: public; Owner: av_design
--

CREATE UNIQUE INDEX articulos_unico_idx ON public.articulos USING btree (COALESCE(marca, ''::text), modelo, categoria);


--
-- Name: conexiones_sala_idx; Type: INDEX; Schema: public; Owner: av_design
--

CREATE INDEX conexiones_sala_idx ON public.conexiones USING btree (sala_id);


--
-- Name: plantilla_articulos_plantilla_idx; Type: INDEX; Schema: public; Owner: av_design
--

CREATE INDEX plantilla_articulos_plantilla_idx ON public.plantilla_articulos USING btree (plantilla_id);


--
-- Name: sala_equipos_sala_idx; Type: INDEX; Schema: public; Owner: av_design
--

CREATE INDEX sala_equipos_sala_idx ON public.sala_equipos USING btree (sala_id);


--
-- Name: salas_sede_idx; Type: INDEX; Schema: public; Owner: av_design
--

CREATE INDEX salas_sede_idx ON public.salas USING btree (sede_id);


--
-- Name: salas_tipologia_idx; Type: INDEX; Schema: public; Owner: av_design
--

CREATE INDEX salas_tipologia_idx ON public.salas USING btree (tipologia);


--
-- Name: salas salas_actualizado; Type: TRIGGER; Schema: public; Owner: av_design
--

CREATE TRIGGER salas_actualizado BEFORE UPDATE ON public.salas FOR EACH ROW EXECUTE FUNCTION public.tocar_actualizado_en();


--
-- Name: articulos articulos_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.articulos
    ADD CONSTRAINT articulos_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE SET NULL;


--
-- Name: conexiones conexiones_articulo_cable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.conexiones
    ADD CONSTRAINT conexiones_articulo_cable_id_fkey FOREIGN KEY (articulo_cable_id) REFERENCES public.articulos(id) ON DELETE SET NULL;


--
-- Name: conexiones conexiones_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.conexiones
    ADD CONSTRAINT conexiones_destino_id_fkey FOREIGN KEY (destino_id) REFERENCES public.sala_equipos(id) ON DELETE CASCADE;


--
-- Name: conexiones conexiones_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.conexiones
    ADD CONSTRAINT conexiones_origen_id_fkey FOREIGN KEY (origen_id) REFERENCES public.sala_equipos(id) ON DELETE CASCADE;


--
-- Name: conexiones conexiones_sala_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.conexiones
    ADD CONSTRAINT conexiones_sala_id_fkey FOREIGN KEY (sala_id) REFERENCES public.salas(id) ON DELETE CASCADE;


--
-- Name: plantilla_articulos plantilla_articulos_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.plantilla_articulos
    ADD CONSTRAINT plantilla_articulos_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id) ON DELETE SET NULL;


--
-- Name: plantilla_articulos plantilla_articulos_plantilla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.plantilla_articulos
    ADD CONSTRAINT plantilla_articulos_plantilla_id_fkey FOREIGN KEY (plantilla_id) REFERENCES public.plantillas_sala(id) ON DELETE CASCADE;


--
-- Name: sala_equipos sala_equipos_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.sala_equipos
    ADD CONSTRAINT sala_equipos_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id) ON DELETE SET NULL;


--
-- Name: sala_equipos sala_equipos_sala_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.sala_equipos
    ADD CONSTRAINT sala_equipos_sala_id_fkey FOREIGN KEY (sala_id) REFERENCES public.salas(id) ON DELETE CASCADE;


--
-- Name: salas salas_plantilla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_plantilla_id_fkey FOREIGN KEY (plantilla_id) REFERENCES public.plantillas_sala(id) ON DELETE SET NULL;


--
-- Name: salas salas_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: av_design
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict qem8vXKbLDJj1sxeoFdQ67p8WGq8lgdKtB1qXfyVLBBEa8m1yw2t0O10eYh69fS

